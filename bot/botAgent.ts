import { GoogleGenAI, Type, FunctionDeclaration, Content, Part } from '@google/genai';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  searchCars,
  getCarDetails,
  getInventorySummary,
  getBusinessInfo,
  HumanHandoffReason
} from './botTools.js';
import { buildSystemPrompt } from './systemPrompt.js';

export interface HandleIncomingMessageParams {
  channel: 'test' | 'whatsapp' | 'tiktok';
  externalUserId: string;
  text: string;
  customerName?: string;
  supabase: SupabaseClient;
  formatCarRow: (row: Record<string, any>) => Record<string, unknown>;
}

export interface HandleIncomingMessageResult {
  conversationId: string;
  reply: string | null;
  handedOff: boolean;
  toolsUsed: string[];
}

// Function declarations definitions for Gemini API
const searchCarsDeclaration: FunctionDeclaration = {
  name: 'search_cars',
  description:
    'Aktiv avtomobilləri axtarır. Yalnız statusu "active" olan maşınlar tapılır. Nəticələrdə avtomobilin linki (url), qiyməti, ili, yürüşü və digər əsas parametrləri qayıdır.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      brand: {
        type: Type.STRING,
        description: 'Marka, məsələn "Ford" və ya "Mercedes"'
      },
      model: {
        type: Type.STRING,
        description: 'Model adı, məsələn "Transit" və ya "Sprinter"'
      },
      bodyType: {
        type: Type.STRING,
        description: 'Kuzov növü: "Yük furqonu", "Sərnişin", "Kombi", "Bortlu", "Soyuducu"'
      },
      minYear: {
        type: Type.INTEGER,
        description: 'Minimum buraxılış ili'
      },
      maxYear: {
        type: Type.INTEGER,
        description: 'Maksimum buraxılış ili'
      },
      minPrice: {
        type: Type.NUMBER,
        description: 'Minimum qiymət (AZN)'
      },
      maxPrice: {
        type: Type.NUMBER,
        description: 'Maksimum qiymət (AZN)'
      },
      maxMileage: {
        type: Type.INTEGER,
        description: 'Maksimum yürüş (km)'
      },
      minSeats: {
        type: Type.INTEGER,
        description: 'Minimum oturacaq sayı'
      },
      query: {
        type: Type.STRING,
        description: 'Sərbəst mətn axtarışı (başlıq, təsvir və ya xüsusiyyətlər üzrə, məsələn "kondisioner")'
      },
      limit: {
        type: Type.INTEGER,
        description: 'Qaytarılacaq nəticə sayı (susmaya görə 5, maks 10)'
      }
    }
  }
};

const getCarDetailsDeclaration: FunctionDeclaration = {
  name: 'get_car_details',
  description:
    'Müəyyən bir avtomobilin ID-sinə əsasən onun tam texniki xüsusiyyətlərini və detallarını gətirir. Əgər maşın tapılmasa və ya satılıbsa found: false qayıdır.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: 'Avtomobilin unikal ID-si (məs. "car-1791216112061")'
      }
    },
    required: ['id']
  }
};

const getInventorySummaryDeclaration: FunctionDeclaration = {
  name: 'get_inventory_summary',
  description:
    'Salonda hal-hazırda satışda olan bütün aktiv avtomobillərin sayı, marka/modellər üzrə bölgüsü və qiymət aralığı icmalını gətirir. "Nəyiniz var?", "Hansı maşınlar var?" kimi ümumi suallar üçün istifadə edilir.',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const getBusinessInfoDeclaration: FunctionDeclaration = {
  name: 'get_business_info',
  description:
    'Kosalar Auto haqqında ümumi məlumatları (ünvan, əlaqə nömrələri, iş saatları, kredit şərtləri, barter, zəmanət və FAQ) gətirir.',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const requestHumanDeclaration: FunctionDeclaration = {
  name: 'request_human',
  description:
    'Söhbəti insan operatora (salondakı satış komandasına) ötürür. Qiymət endirimi, kredit/lizinq, barter, şikayət, müştərinin operator tələb etməsi, test sürüşü və ya salona baxış üçün vaxt təyin edilməsi hallarında mütləq çağırılmalıdır.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        enum: [
          'price_negotiation',
          'credit_or_leasing',
          'trade_in',
          'complaint',
          'customer_asked_for_human',
          'test_drive_or_visit',
          'bot_unsure'
        ],
        description: 'Ötürülmə səbəbi'
      }
    },
    required: ['reason']
  }
};

const botToolsList = [
  searchCarsDeclaration,
  getCarDetailsDeclaration,
  getInventorySummaryDeclaration,
  getBusinessInfoDeclaration,
  requestHumanDeclaration
];

/**
 * Channel-agnostic entry point for AI sales assistant message processing.
 */
export async function handleIncomingMessage(
  params: HandleIncomingMessageParams
): Promise<HandleIncomingMessageResult> {
  const {
    channel,
    externalUserId,
    text,
    customerName,
    supabase,
    formatCarRow
  } = params;

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY mühit dəyişəni təyin edilməyib.');
    (err as any).status = 503;
    throw err;
  }

  const modelName = (process.env.BOT_MODEL || 'gemini-2.5-flash').trim();

  // Trim input text to 2000 characters maximum
  const cleanText = String(text || '').slice(0, 2000).trim();
  if (!cleanText) {
    throw new Error('Mesaj mətni boş ola bilməz.');
  }

  // 1. Upsert conversation in Supabase by (channel, external_user_id)
  const nowIso = new Date().toISOString();
  const { data: convData, error: convError } = await supabase
    .from('bot_conversations')
    .upsert(
      {
        channel,
        external_user_id: externalUserId,
        customer_name: customerName || null,
        updated_at: nowIso
      },
      { onConflict: 'channel,external_user_id' }
    )
    .select('id, channel, external_user_id, customer_name, status, handoff_reason')
    .single();

  if (convError || !convData) {
    throw new Error(`Söhbət bazaya yazıla bilmədi: ${convError?.message || 'Naməlum xəta'}`);
  }

  const conversationId = convData.id;

  // 2. Save the user message to bot_messages (role user)
  const { error: userMsgError } = await supabase
    .from('bot_messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content: cleanText
    });

  if (userMsgError) {
    throw new Error(`İstifadəçi mesajı qeyd edilə bilmədi: ${userMsgError.message}`);
  }

  // 3. If conversation status is already 'human', do NOT call AI. Return reply: null, handedOff: true.
  if (convData.status === 'human') {
    return {
      conversationId,
      reply: null,
      handedOff: true,
      toolsUsed: []
    };
  }

  // 4. Load the last 20 messages from history to construct the context
  const { data: historyData, error: historyError } = await supabase
    .from('bot_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (historyError) {
    throw new Error(`Mesaj tarixçəsi oxuna bilmədi: ${historyError.message}`);
  }

  const chronologicalHistory = (historyData || []).reverse();

  // Convert history into Gemini Content objects (user and model)
  const contents: Content[] = [];
  for (const msg of chronologicalHistory) {
    if (msg.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: msg.content }]
      });
    } else if (msg.role === 'assistant') {
      contents.push({
        role: 'model',
        parts: [{ text: msg.content }]
      });
    }
  }

  // Ensure current message is at least included in the conversation
  if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
    contents.push({
      role: 'user',
      parts: [{ text: cleanText }]
    });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const systemInstruction = buildSystemPrompt();

  let round = 0;
  const maxRounds = 5;
  const toolsUsedSet = new Set<string>();
  let handoffTriggered = false;
  let handoffReasonRecorded: HumanHandoffReason | null = null;
  let finalReplyText = '';

  // Setup 25-second overall timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('AI cavablandırma vaxtı bitdi (25s timeout). Zəhmət olmasa yenidən cəhd edin.'));
    }, 25000);
  });

  const executionPromise = (async () => {
    while (round < maxRounds) {
      round++;

      const isLastAllowedRound = round === maxRounds;
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          // On last round, force standard text completion without more tool calls
          ...(isLastAllowedRound ? {} : { tools: [{ functionDeclarations: botToolsList }] })
        }
      });

      const candidate = response.candidates?.[0];
      if (!candidate || !candidate.content) {
        throw new Error('Modeldən cavab alına bilmədi.');
      }

      const modelParts: Part[] = candidate.content.parts || [];
      contents.push({
        role: 'model',
        parts: modelParts
      });

      const functionCalls = response.functionCalls;

      // If no function calls, extract text response and break
      if (!functionCalls || functionCalls.length === 0 || isLastAllowedRound) {
        finalReplyText = response.text || '';
        if (!finalReplyText && modelParts.length > 0) {
          finalReplyText = modelParts
            .map((p) => p.text || '')
            .filter(Boolean)
            .join(' ')
            .trim();
        }
        break;
      }

      // Execute each tool call requested by the model
      const toolResponseParts: Part[] = [];

      for (const call of functionCalls) {
        const toolName = call.name;
        toolsUsedSet.add(toolName);
        const args = (call.args || {}) as Record<string, any>;

        let toolResult: any = null;

        try {
          if (toolName === 'search_cars') {
            toolResult = await searchCars(supabase, formatCarRow, args);
          } else if (toolName === 'get_car_details') {
            toolResult = await getCarDetails(supabase, formatCarRow, String(args.id || ''));
          } else if (toolName === 'get_inventory_summary') {
            toolResult = await getInventorySummary(supabase, formatCarRow);
          } else if (toolName === 'get_business_info') {
            toolResult = await getBusinessInfo(supabase);
          } else if (toolName === 'request_human') {
            handoffTriggered = true;
            handoffReasonRecorded = (args.reason as HumanHandoffReason) || 'bot_unsure';
            toolResult = {
              success: true,
              message:
                'Operator çağırışı qeydə alındı. Müştəriyə nəzakətlə bildirin ki, tezliklə salondakı əməkdaşımız əlaqə saxlayacaq.'
            };
          } else {
            toolResult = { error: `Bilinməyən alət: ${toolName}` };
          }
        } catch (toolErr: any) {
          toolResult = { error: toolErr?.message || 'Alətin icrası zamanı xəta baş verdi' };
        }

        toolResponseParts.push({
          functionResponse: {
            name: toolName,
            response: { result: toolResult }
          }
        });
      }

      contents.push({
        role: 'user',
        parts: toolResponseParts
      });
    }

    if (!finalReplyText && handoffTriggered) {
      finalReplyText = 'Zəhmət olmasa bir qədər gözləyin, satış komandamız tezliklə sizinlə əlaqə saxlayacaq.';
    }

    return finalReplyText;
  })();

  // Race model execution against the 25-second timeout
  const finalReply = await Promise.race([executionPromise, timeoutPromise]);

  // 5. If request_human was called during the session, update conversation status to 'human'
  if (handoffTriggered) {
    const updateTime = new Date().toISOString();
    const { error: handoffUpdateError } = await supabase
      .from('bot_conversations')
      .update({
        status: 'human',
        handoff_reason: handoffReasonRecorded || 'customer_asked_for_human',
        updated_at: updateTime
      })
      .eq('id', conversationId);

    if (handoffUpdateError) {
      throw new Error(`Operatora ötürmə statusu qeyd edilə bilmədi: ${handoffUpdateError.message}`);
    }
  }

  // 6. Save assistant reply to bot_messages (role assistant)
  const toolsUsedArray = Array.from(toolsUsedSet);
  const { error: assistantMsgError } = await supabase
    .from('bot_messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: finalReply,
      tools_used: toolsUsedArray
    });

  if (assistantMsgError) {
    throw new Error(`Köməkçi cavabı qeyd edilə bilmədi: ${assistantMsgError.message}`);
  }

  // 7. Update conversation's updated_at timestamp
  await supabase
    .from('bot_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return {
    conversationId,
    reply: finalReply,
    handedOff: handoffTriggered,
    toolsUsed: toolsUsedArray
  };
}
