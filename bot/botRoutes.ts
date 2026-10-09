import express from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { handleIncomingMessage } from './botAgent.js';

interface BotRoutesConfig {
  getServerSupabase: () => SupabaseClient | null;
  requireAdminAuth: express.RequestHandler;
  formatSupabaseCarRow: (row: Record<string, any>) => Record<string, unknown>;
}

// In-memory token sliding-window rate limiter for test chat (max 30 requests/minute per token)
interface RateLimitRecord {
  timestamps: number[];
}
const testChatRateLimits = new Map<string, RateLimitRecord>();

function checkTestChatRateLimit(tokenKey: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  let record = testChatRateLimits.get(tokenKey);
  if (!record) {
    record = { timestamps: [] };
    testChatRateLimits.set(tokenKey, record);
  }

  // Filter timestamps to the last 60 seconds
  record.timestamps = record.timestamps.filter((ts) => ts > oneMinuteAgo);

  if (record.timestamps.length >= 30) {
    const oldest = record.timestamps[0];
    const waitSeconds = Math.max(1, Math.ceil((oldest + 60000 - now) / 1000));
    return { allowed: false, waitSeconds };
  }

  record.timestamps.push(now);
  return { allowed: true };
}

export function createBotRouter(config: BotRoutesConfig): express.Router {
  const { getServerSupabase, requireAdminAuth, formatSupabaseCarRow } = config;
  const router = express.Router();

  // Helper to ensure Supabase client is available
  const getSupabaseOrThrow = (res: express.Response): SupabaseClient | null => {
    const supabase = getServerSupabase();
    if (!supabase) {
      res.status(500).json({
        success: false,
        error: 'Məlumat bazasına qoşulmaq mümkün olmadı. Supabase konfiqurasiyasını yoxlayın.'
      });
      return null;
    }
    return supabase;
  };

  /**
   * POST /api/admin/bot/test-chat
   * Body: { sessionId: string, message: string }
   */
  router.post('/test-chat', requireAdminAuth, async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const tokenKey = authHeader.replace(/^Bearer\s+/i, '').trim() || req.ip || 'admin';

      const rateCheck = checkTestChatRateLimit(tokenKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          success: false,
          error: `Həddindən artıq çox sorğu! Zəhmət olmasa ${rateCheck.waitSeconds} saniyə gözləyin (limit: 30 sorğu/dəqiqə).`
        });
        return;
      }

      const { sessionId, message } = req.body || {};
      if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
        res.status(400).json({ success: false, error: 'sessionId daxil edilməlidir.' });
        return;
      }

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ success: false, error: 'Mesaj mətni daxil edilməlidir.' });
        return;
      }

      const supabase = getSupabaseOrThrow(res);
      if (!supabase) return;

      const result = await handleIncomingMessage({
        channel: 'test',
        externalUserId: sessionId.trim(),
        text: message.trim(),
        customerName: 'Admin Tester',
        supabase,
        formatCarRow: formatSupabaseCarRow
      });

      res.json({
        success: true,
        conversationId: result.conversationId,
        reply: result.reply,
        handedOff: result.handedOff,
        toolsUsed: result.toolsUsed
      });
    } catch (err: any) {
      const statusCode = err.status || 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || 'AI bot sorğusunda xəta baş verdi.'
      });
    }
  });

  /**
   * GET /api/admin/bot/conversations
   * Returns latest 50 conversations with last message preview.
   */
  router.get('/conversations', requireAdminAuth, async (_req, res) => {
    try {
      const supabase = getSupabaseOrThrow(res);
      if (!supabase) return;

      const { data: convs, error: convError } = await supabase
        .from('bot_conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (convError) {
        res.status(500).json({
          success: false,
          error: `Söhbətlər oxunarkən xəta: ${convError.message}`
        });
        return;
      }

      const conversationList = convs || [];
      const convIds = conversationList.map((c) => c.id);

      // Fetch latest message per conversation
      const lastMessagesMap: Record<string, { content: string; created_at: string; role: string }> = {};

      if (convIds.length > 0) {
        const { data: msgs, error: msgError } = await supabase
          .from('bot_messages')
          .select('conversation_id, role, content, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false });

        if (!msgError && Array.isArray(msgs)) {
          for (const m of msgs) {
            if (!lastMessagesMap[m.conversation_id]) {
              lastMessagesMap[m.conversation_id] = {
                content: m.content,
                created_at: m.created_at,
                role: m.role
              };
            }
          }
        }
      }

      const result = conversationList.map((c) => ({
        id: c.id,
        channel: c.channel,
        external_user_id: c.external_user_id,
        customer_name: c.customer_name,
        status: c.status,
        handoff_reason: c.handoff_reason,
        created_at: c.created_at,
        updated_at: c.updated_at,
        lastMessage: lastMessagesMap[c.id]?.content || '',
        lastMessageRole: lastMessagesMap[c.id]?.role || '',
        lastMessageTime: lastMessagesMap[c.id]?.created_at || c.updated_at
      }));

      res.json({ success: true, conversations: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Söhbətlər yüklənə bilmədi.' });
    }
  });

  /**
   * GET /api/admin/bot/conversations/:id/messages
   * Returns all messages of one conversation.
   */
  router.get('/conversations/:id/messages', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const supabase = getSupabaseOrThrow(res);
      if (!supabase) return;

      const { data: messages, error } = await supabase
        .from('bot_messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (error) {
        res.status(500).json({
          success: false,
          error: `Mesajlar oxunarkən xəta: ${error.message}`
        });
        return;
      }

      res.json({ success: true, messages: messages || [] });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Mesajlar oxuna bilmədi.' });
    }
  });

  /**
   * POST /api/admin/bot/conversations/:id/release
   * Sets status = 'bot' (staff hands the conversation back to the bot).
   */
  router.post('/conversations/:id/release', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const supabase = getSupabaseOrThrow(res);
      if (!supabase) return;

      const { data, error } = await supabase
        .from('bot_conversations')
        .update({
          status: 'bot',
          handoff_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        res.status(500).json({
          success: false,
          error: `Söhbət yenidən aktivləşdirilə bilmədi: ${error.message}`
        });
        return;
      }

      res.json({ success: true, conversation: data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Əməliyyat uğursuz oldu.' });
    }
  });

  /**
   * DELETE /api/admin/bot/conversations/:id
   * Deletes a test conversation (only allowed when channel = 'test').
   */
  router.delete('/conversations/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const supabase = getSupabaseOrThrow(res);
      if (!supabase) return;

      // Verify conversation exists and channel is 'test'
      const { data: conv, error: fetchErr } = await supabase
        .from('bot_conversations')
        .select('channel')
        .eq('id', id)
        .single();

      if (fetchErr || !conv) {
        res.status(404).json({ success: false, error: 'Söhbət tapılmadı.' });
        return;
      }

      if (conv.channel !== 'test') {
        res.status(403).json({
          success: false,
          error: 'Yalnız test kanalı olan söhbətlər silinə bilər.'
        });
        return;
      }

      const { error: deleteErr } = await supabase
        .from('bot_conversations')
        .delete()
        .eq('id', id);

      if (deleteErr) {
        res.status(500).json({
          success: false,
          error: `Söhbət silinərkən xəta: ${deleteErr.message}`
        });
        return;
      }

      res.json({ success: true, message: 'Test söhbəti uğurla silindi.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Silinmə uğursuz oldu.' });
    }
  });

  /**
   * GET /api/admin/bot/faq
   * Returns all FAQ records.
   */
  router.get('/faq', requireAdminAuth, async (_req, res) => {
    try {
      const supabase = getSupabaseOrThrow(res);
      if (!supabase) return;

      const { data, error } = await supabase
        .from('bot_faq')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        res.status(500).json({
          success: false,
          error: `FAQ oxunarkən xəta: ${error.message}`
        });
        return;
      }

      res.json({ success: true, faq: data || [] });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'FAQ oxuna bilmədi.' });
    }
  });

  /**
   * POST /api/admin/bot/faq
   * Creates a new FAQ entry: topic (1–120 chars) and answer (1–2000 chars).
   */
  router.post('/faq', requireAdminAuth, async (req, res) => {
    try {
      const { topic, answer, sort_order } = req.body || {};

      const cleanTopic = String(topic || '').trim();
      const cleanAnswer = String(answer || '').trim();
      const cleanSortOrder = typeof sort_order === 'number' ? sort_order : 0;

      if (!cleanTopic || cleanTopic.length > 120) {
        res.status(400).json({
          success: false,
          error: 'Mövzu (topic) 1 ilə 120 simvol arasında olmalıdır.'
        });
        return;
      }

      if (!cleanAnswer || cleanAnswer.length > 2000) {
        res.status(400).json({
          success: false,
          error: 'Cavab (answer) 1 ilə 2000 simvol arasında olmalıdır.'
        });
        return;
      }

      const supabase = getSupabaseOrThrow(res);
      if (!supabase) return;

      const { data, error } = await supabase
        .from('bot_faq')
        .insert({
          topic: cleanTopic,
          answer: cleanAnswer,
          sort_order: cleanSortOrder,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        res.status(500).json({
          success: false,
          error: `FAQ əlavə edilərkən xəta: ${error.message}`
        });
        return;
      }

      res.status(201).json({ success: true, item: data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'FAQ yaradılarkən xəta baş verdi.' });
    }
  });

  /**
   * PUT /api/admin/bot/faq/:id
   * Updates an existing FAQ entry.
   */
  router.put('/faq/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { topic, answer, sort_order } = req.body || {};

      const cleanTopic = String(topic || '').trim();
      const cleanAnswer = String(answer || '').trim();
      const cleanSortOrder = typeof sort_order === 'number' ? sort_order : 0;

      if (!cleanTopic || cleanTopic.length > 120) {
        res.status(400).json({
          success: false,
          error: 'Mövzu (topic) 1 ilə 120 simvol arasında olmalıdır.'
        });
        return;
      }

      if (!cleanAnswer || cleanAnswer.length > 2000) {
        res.status(400).json({
          success: false,
          error: 'Cavab (answer) 1 ilə 2000 simvol arasında olmalıdır.'
        });
        return;
      }

      const supabase = getSupabaseOrThrow(res);
      if (!supabase) return;

      const { data, error } = await supabase
        .from('bot_faq')
        .update({
          topic: cleanTopic,
          answer: cleanAnswer,
          sort_order: cleanSortOrder,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        res.status(500).json({
          success: false,
          error: `FAQ yenilənərkən xəta: ${error.message}`
        });
        return;
      }

      res.json({ success: true, item: data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'FAQ yenilənə bilmədi.' });
    }
  });

  /**
   * DELETE /api/admin/bot/faq/:id
   * Deletes an FAQ entry.
   */
  router.delete('/faq/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const supabase = getSupabaseOrThrow(res);
      if (!supabase) return;

      const { error } = await supabase
        .from('bot_faq')
        .delete()
        .eq('id', id);

      if (error) {
        res.status(500).json({
          success: false,
          error: `FAQ silinərkən xəta: ${error.message}`
        });
        return;
      }

      res.json({ success: true, message: 'FAQ uğurla silindi.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'FAQ silinə bilmədi.' });
    }
  });

  return router;
}
