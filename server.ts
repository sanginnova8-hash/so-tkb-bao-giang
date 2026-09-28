import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));

// Helper to resolve API Key - ALWAYS prioritize user-provided API key from body or headers
function resolveApiKey(req: express.Request): { key: string | null; isUserKey: boolean } {
  // 1. Top priority: key in request body
  if (req.body?.apiKey && typeof req.body.apiKey === 'string' && req.body.apiKey.trim()) {
    return { key: req.body.apiKey.trim(), isUserKey: true };
  }
  // 2. Second priority: key in custom header 'x-gemini-api-key' or Authorization Bearer
  const headerKey = req.headers['x-gemini-api-key'];
  if (headerKey && typeof headerKey === 'string' && headerKey.trim()) {
    return { key: headerKey.trim(), isUserKey: true };
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer && bearer !== 'null' && bearer !== 'undefined') {
      return { key: bearer, isUserKey: true };
    }
  }
  // 3. Fallback: server environment variable
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    return { key: process.env.GEMINI_API_KEY.trim(), isUserKey: false };
  }
  return { key: null, isUserKey: false };
}

// Helper to call Gemini with automatic fallback on 503 (High demand) or 429 (Rate limit)
async function generateContentWithAutoFallback(
  ai: GoogleGenAI,
  preferredModel: string,
  params: {
    contents: any;
    config?: any;
  }
): Promise<{ response: any; usedModel: string; wasFallback: boolean }> {
  const chosen = (preferredModel && preferredModel.trim()) ? preferredModel.trim() : 'gemini-3.6-flash';

  // NEVER use deprecated 2.5 or 2.0 or 1.5 models. Only use valid 3.x models!
  const fallbackSequence = [
    chosen,
    chosen !== 'gemini-3.6-flash' ? 'gemini-3.6-flash' : 'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx && !m.includes('2.5') && !m.includes('2.0') && !m.includes('1.5'));

  let lastError: any = null;

  for (let i = 0; i < fallbackSequence.length; i++) {
    const currentModel = fallbackSequence[i];
    try {
      console.log(`[Gemini SDK] Đang gọi model: ${currentModel}...`);
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: params.contents,
        config: params.config,
      });

      return {
        response,
        usedModel: currentModel,
        wasFallback: currentModel !== chosen,
      };
    } catch (err: any) {
      lastError = err;
      const errorMsg = String(err?.message || err?.status || err || '');
      const isTransient =
        errorMsg.includes('503') ||
        errorMsg.includes('high demand') ||
        errorMsg.includes('UNAVAILABLE') ||
        errorMsg.includes('429') ||
        errorMsg.includes('RESOURCE_EXHAUSTED') ||
        errorMsg.includes('overloaded');

      if (isTransient && i < fallbackSequence.length - 1) {
        console.warn(`[Gemini SDK] Model ${currentModel} đang quá tải tạm thời (503/429). Tự động chuyển sang ${fallbackSequence[i + 1]}...`);
        await new Promise((res) => setTimeout(res, 600));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

// Health check and Gemini configuration status
app.get('/api/gemini-status', (req, res) => {
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  res.json({
    hasServerApiKey: hasEnvKey,
    defaultModel: 'gemini-3.8-flash',
  });
});

// Endpoint to test Gemini API key and connection
app.post('/api/test-gemini-key', async (req, res) => {
  try {
    const { model } = req.body;
    const { key: keyToUse, isUserKey } = resolveApiKey(req);

    if (!keyToUse) {
      return res.status(400).json({
        success: false,
        error: 'Chưa có API key Gemini. Vui lòng nhập API Key để kiểm tra.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey: keyToUse,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const modelToUse = model || 'gemini-3.8-flash';
    const startTime = Date.now();

    const { response, usedModel, wasFallback } = await generateContentWithAutoFallback(
      ai,
      modelToUse,
      { contents: [{ text: 'Trả lời đúng 1 chữ: OK' }] }
    );

    const latencyMs = Date.now() - startTime;
    const responseText = response.text?.trim() || 'OK';

    let successMsg = `Kết nối thành công! Khóa API nạp vào hoạt động rất tốt (Độ trễ: ${latencyMs}ms).`;
    if (wasFallback) {
      successMsg = `Kết nối thành công! Khóa API hoạt động tốt (Lưu ý: model ${modelToUse} đang tạm quá tải 503 trên máy chủ Google, hệ thống đã tự động kết nối qua ${usedModel} ổn định).`;
    }

    return res.json({
      success: true,
      message: successMsg,
      model: usedModel,
      requestedModel: modelToUse,
      wasFallback,
      isUserKey,
      latencyMs,
      response: responseText,
    });
  } catch (error: any) {
    console.error('Error testing Gemini key:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Khóa API không hợp lệ hoặc không có quyền truy cập Gemini API.',
    });
  }
});

// Endpoint to list supported and available Gemini models directly from Google Gemini API
app.post('/api/list-gemini-models', async (req, res) => {
  try {
    const { key: keyToUse } = resolveApiKey(req);

    if (!keyToUse) {
      return res.status(400).json({
        success: false,
        error: 'Chưa có API Key. Vui lòng nhập API Key để tải danh sách models.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey: keyToUse,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const dynamicModels: any[] = [];

    try {
      // Call Google API to get all available models for this specific API key
      const listIterator = await ai.models.list();
      for await (const m of listIterator) {
        const rawName = m.name || '';
        const rawId = rawName.replace(/^models\//, '');

        // Exclude specialized non-text models (audio-only, video-only, tts, embeddings, robotics)
        const isExcluded =
          rawId.includes('tts') ||
          rawId.includes('embedding') ||
          rawId.includes('veo') ||
          rawId.includes('lyria') ||
          rawId.includes('live') ||
          rawId.includes('transcribe') ||
          rawId.includes('image') ||
          rawId.includes('aqa') ||
          rawId.includes('robotics') ||
          rawId.includes('computer-use') ||
          rawId.includes('customtools');

        const supportsContent =
          Array.isArray(m.supportedActions) && m.supportedActions.includes('generateContent');

        const isDeprecated = rawId.includes('2.5') || rawId.includes('2.0') || rawId.includes('1.5');

        if (!isExcluded && !isDeprecated && supportsContent && (rawId.startsWith('gemini') || rawId.startsWith('gemma'))) {
          let badge = '';
          let isLatest = false;

          if (rawId === 'gemini-3.6-flash') {
            badge = 'Thế hệ 3.6 - Khuyên dùng';
          } else if (rawId === 'gemini-3.8-flash') {
            badge = 'Mới nhất';
            isLatest = true;
          } else if (rawId.includes('3.7')) {
            badge = 'Thế hệ 3.7';
          } else if (rawId.includes('3.5')) {
            badge = 'Thế hệ 3.5';
          } else if (rawId.includes('pro')) {
            badge = 'Suy luận sâu';
          }

          dynamicModels.push({
            id: rawId,
            name: m.displayName || rawId,
            badge,
            isLatest,
            description: m.description || `Mô hình ${m.displayName || rawId}`,
          });
        }
      }
    } catch (listErr: any) {
      console.warn('Could not call ai.models.list(), falling back to curated list:', listErr.message);
    }

    // Curated active 3.x models that must always be present
    const curatedModels = [
      {
        id: 'gemini-3.6-flash',
        name: 'Gemini 3.6 Flash',
        badge: 'Thế hệ 3.6 - Khuyên dùng',
        isLatest: false,
        description: 'Mô hình thế hệ 3.6 tốc độ cao, xử lý bảng PPCT và ảnh TKB cực kỳ mượt mà, chuẩn xác.',
      },
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        badge: 'Mới nhất',
        isLatest: true,
        description: 'Mô hình thế hệ 3.8 mới nhất của Google, hiệu năng xử lý văn bản cao.',
      },
      {
        id: 'gemini-3.7-flash',
        name: 'Gemini 3.7 Flash',
        badge: 'Thế hệ 3.7',
        isLatest: false,
        description: 'Mô hình thế hệ 3.7 cân bằng giữa tốc độ và tư duy logic.',
      },
      {
        id: 'gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        badge: 'Thế hệ 3.5',
        isLatest: false,
        description: 'Mô hình thế hệ 3.5 tốc độ cao, nhận diện nhanh.',
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro',
        badge: 'Suy luận sâu',
        isLatest: false,
        description: 'Mô hình suy luận chuyên sâu cho tài liệu phức tạp.',
      },
    ];

    // Combine dynamic models with curated ones, avoiding duplicates
    const combinedMap = new Map<string, any>();
    for (const m of curatedModels) {
      combinedMap.set(m.id, m);
    }
    for (const m of dynamicModels) {
      if (!combinedMap.has(m.id)) {
        combinedMap.set(m.id, m);
      }
    }

    const finalModelsList = Array.from(combinedMap.values());

    return res.json({
      success: true,
      count: finalModelsList.length,
      defaultModel: 'gemini-3.6-flash',
      models: finalModelsList,
    });
  } catch (error: any) {
    console.error('Error in /api/list-gemini-models:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Không thể tải danh sách model với khóa API hiện tại.',
    });
  }
});

// Endpoint to parse curriculum (PPCT) with Gemini
app.post('/api/parse-ppct', async (req, res) => {
  try {
    const {
      model: requestedModel,
      contentText,
      fileBase64,
      mimeType,
      fileName,
      defaultSubject,
      defaultGrade,
      targetSubject,
      targetGrades,
    } = req.body;

    // ALWAYS prioritize user-provided API key from body or headers
    const { key: keyToUse, isUserKey } = resolveApiKey(req);

    if (!keyToUse) {
      return res.status(400).json({
        error: 'Chưa có API key Gemini. Vui lòng nhập API Key của bạn để sử dụng tính năng trích xuất AI.',
      });
    }

    console.log(`[Parse PPCT] Nguồn API Key: ${isUserKey ? 'Khóa người dùng nạp vào (' + keyToUse.slice(0, 6) + '...)' : 'Khóa hệ thống'}`);

    const ai = new GoogleGenAI({
      apiKey: keyToUse,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const activeSubject = targetSubject || defaultSubject || 'Toán';
    const activeGradesStr = Array.isArray(targetGrades) && targetGrades.length > 0
      ? targetGrades.join(', ')
      : defaultGrade ? String(defaultGrade) : 'Tự động nhận diện từ tài liệu (10, 11, 12...)';

    const systemPrompt = `Bạn là trợ lý chuyên gia về giáo dục và phân phối chương trình (PPCT) phổ thông / cao đẳng Việt Nam.
Nhiệm vụ của bạn là đọc kỹ tài liệu Phân phối chương trình được cung cấp (từ file Word, Excel, PDF, ảnh chụp hoặc văn bản) và trích xuất thành danh sách bài học có cấu trúc chuẩn xác theo từng môn và từng khối lớp.

QUY TẮC BẮT BUỘC - TUYỆT ĐỐI TUÂN THỦ:
1. TUYỆT ĐỐI GIỮ NGUYÊN 100% TÊN BÀI HỌC GỐC (lessonTitle):
   - TUYỆT ĐỐI KHÔNG ĐƯỢC THAY ĐỔI TÊN BÀI TRONG PHÂN PHỐI CHƯƠNG TRÌNH GỐC.
   - Giữ nguyên từng từ, từng chữ, dấu câu, chữ số La Mã, ký tự đặc biệt y hệt văn bản gốc.
   - KHÔNG ĐƯỢC tự ý thêm bất kỳ hậu tố nào như "(Tiết 1)", "(Tiết 2)", "(T1)", "(T2)", "(tiếp theo)", "(tt)" vào tên bài dạy.
   - Nếu trong tài liệu gốc một bài học gồm nhiều tiết (ví dụ: cột số tiết là 2 hoặc ghi "Tiết 1-2: Bài 1: Mệnh đề"):
     Khi tách thành từng tiết riêng biệt:
     + Tiết 1: lessonTitle = "Bài 1: Mệnh đề"
     + Tiết 2: lessonTitle = "Bài 1: Mệnh đề"
     CẢ HAI TIẾT ĐỀU PHẢI GIỮ NGUYÊN CHÍNH XÁC TÊN BÀI GỐC, KHÔNG ĐƯỢC THÊM "(Tiết 1)" HAY "(Tiết 2)".
   - KHÔNG tóm tắt, KHÔNG diễn giải, KHÔNG viết tắt nếu bản gốc không viết tắt.

2. Xác định Môn học (Subject) cho từng bài học:
   - Các môn chuẩn: "Toán", "HĐTN-HN" (viết tắt của Hoạt động trải nghiệm, hướng nghiệp / HĐTNHN / HDTNHN), "Ngữ văn", "Tiếng Anh", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "Tin học", "GDCD", "Công nghệ"...
   - ĐẶC BIỆT LƯU Ý: Nếu tài liệu ghi "HĐTNHN", "HDTNHN", "HĐTN - HN", "HĐTN, HN", "Hoạt động trải nghiệm hướng nghiệp" thì luôn chuẩn hóa tên môn thành "HĐTN-HN".
   - Môn yêu cầu ưu tiên: "${activeSubject}". Nếu tài liệu không ghi rõ môn khác, gán môn này.

3. Xác định Khối lớp (Grade) cho từng bài học:
   - Một tài liệu PPCT có thể chứa bài dạy của MỘT HOẶC NHIỀU KHỐI LỚP (Ví dụ: "Toán 10 và Toán 12", "Toán 10-12" gồm Khối 10, Khối 11, Khối 12, hoặc "HĐTNHN 10, 11, 12").
   - Hãy nhận diện chính xác từng phần / bảng / phân mục trong tài liệu thuộc khối lớp nào: Khối 10, Khối 11, Khối 12 (hoặc 6, 7, 8, 9).
   - Khối lớp ưu tiên xử lý: ${activeGradesStr}.
   - Trích xuất toàn bộ tất cả các bài của từng khối và gán đúng thuộc tính "grade" cho từng bài (ví dụ: bài lớp 10 thì grade=10, bài lớp 12 thì grade=12).

4. Cấu trúc từng bài học:
   - Tiết PPCT (periodNumber): Số nguyên liên tục tăng dần (1, 2, 3, 4...) tính riêng cho từng môn và khối lớp.
   - Tên bài dạy (lessonTitle): Đúng 100% nguyên văn tên bài học gốc trong tài liệu.
   - Học kỳ (semester): "Học kỳ I" hoặc "Học kỳ II".
   - Phân loại (category): Đại số, Hình học, Giải tích, Đọc hiểu, Hoạt động chủ đề, Ôn tập, Kiểm tra, Chuyên đề...
   - Ghi chú (note): Ghi chú thêm nếu có trong tài liệu.`;

    const contents: any[] = [];
    let extractedTextFromDoc = '';

    const lowerFileName = (fileName || '').toLowerCase();
    const effectiveMime = (mimeType || '').toLowerCase();

    // Check file type and process accordingly
    if (fileBase64) {
      const buffer = Buffer.from(fileBase64, 'base64');

      // 1. WORD DOCUMENT (.docx)
      if (
        lowerFileName.endsWith('.docx') ||
        effectiveMime.includes('wordprocessingml') ||
        effectiveMime.includes('msword')
      ) {
        try {
          const docxResult = await mammoth.convertToHtml({ buffer });
          extractedTextFromDoc = `[NỘI DUNG TÀI LIỆU WORD .DOCX ĐÃ TRÍCH XUẤT]:\n${docxResult.value}`;
        } catch (docxErr: any) {
          console.warn('Mammoth convertToHtml failed, trying raw text:', docxErr);
          const rawResult = await mammoth.extractRawText({ buffer });
          extractedTextFromDoc = `[NỘI DUNG VĂN BẢN WORD .DOCX]:\n${rawResult.value}`;
        }
      }
      // 2. EXCEL SPREADSHEET (.xlsx, .xls, .xlsm, .csv)
      else if (
        lowerFileName.endsWith('.xlsx') ||
        lowerFileName.endsWith('.xls') ||
        lowerFileName.endsWith('.xlsm') ||
        lowerFileName.endsWith('.csv') ||
        effectiveMime.includes('spreadsheet') ||
        effectiveMime.includes('excel') ||
        effectiveMime.includes('csv')
      ) {
        try {
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetsText: string[] = [];
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            if (sheet) {
              const csvData = XLSX.utils.sheet_to_csv(sheet);
              if (csvData.trim()) {
                sheetsText.push(`--- BẢNG DỮ LIỆU EXCEL (Sheet: ${sheetName}) ---\n${csvData}`);
              }
            }
          });
          extractedTextFromDoc = sheetsText.join('\n\n');
        } catch (excelErr: any) {
          console.error('Error parsing excel buffer:', excelErr);
          throw new Error('Không thể đọc dữ liệu từ file Excel: ' + excelErr.message);
        }
      }
      // 3. PDF DOCUMENT (.pdf) - Gemini supports native PDF inlineData
      else if (lowerFileName.endsWith('.pdf') || effectiveMime === 'application/pdf') {
        contents.push({
          inlineData: {
            data: fileBase64,
            mimeType: 'application/pdf',
          },
        });
      }
      // 4. IMAGES (.png, .jpg, .jpeg, .webp, .heic) - Gemini supports native image inlineData
      else if (
        effectiveMime.startsWith('image/') ||
        ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'].some((ext) => lowerFileName.endsWith(ext))
      ) {
        const imageMime = effectiveMime.startsWith('image/')
          ? effectiveMime
          : lowerFileName.endsWith('.png')
          ? 'image/png'
          : 'image/jpeg';

        contents.push({
          inlineData: {
            data: fileBase64,
            mimeType: imageMime,
          },
        });
      }
      // 5. TEXT OR OTHER FORMATS
      else {
        try {
          const textStr = buffer.toString('utf-8');
          extractedTextFromDoc = `[NỘI DUNG TẬP TIN VĂN BẢN]:\n${textStr}`;
        } catch {
          // If fallback fails, try sending as application/pdf or octet-stream
          contents.push({
            inlineData: {
              data: fileBase64,
              mimeType: 'application/pdf',
            },
          });
        }
      }
    }

    // Build the user prompt
    const partsText: string[] = [];

    if (contentText && contentText.trim()) {
      partsText.push(`Nội dung văn bản cung cấp:\n${contentText.trim()}`);
    }

    if (extractedTextFromDoc && extractedTextFromDoc.trim()) {
      partsText.push(`Dữ liệu bảng/văn bản từ file đính kèm:\n${extractedTextFromDoc.trim()}`);
    }

    partsText.push(`Hãy trích xuất tất cả các bài học trong phân phối chương trình trên thành danh sách hoàn chỉnh.
- Môn dự kiến (nếu tài liệu không nói rõ): ${activeSubject}
- Khối lớp dự kiến: ${activeGradesStr}`);

    contents.push({ text: partsText.join('\n\n') });

    const modelToUse = requestedModel || 'gemini-3.6-flash';
    const { response, usedModel, wasFallback } = await generateContentWithAutoFallback(
      ai,
      modelToUse,
      {
        contents: contents,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING, description: 'Tên môn học chính' },
              grade: { type: Type.INTEGER, description: 'Khối lớp chính (ví dụ 10)' },
              detectedSubjects: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Danh sách các môn học nhận diện được',
              },
              detectedGrades: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: 'Danh sách các khối lớp nhận diện được',
              },
              semester: {
                type: Type.STRING,
                enum: ['Học kỳ I', 'Học kỳ II'],
                description: 'Học kỳ',
              },
              entries: {
                type: Type.ARRAY,
                description: 'Danh sách các tiết bài học theo phân phối chương trình',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    subject: { type: Type.STRING, description: 'Môn học của bài (ví dụ Toán, HĐTN-HN)' },
                    grade: { type: Type.INTEGER, description: 'Khối lớp của bài (ví dụ 10, 11, 12)' },
                    periodNumber: { type: Type.INTEGER, description: 'Số thứ tự tiết PPCT (1, 2, 3...)' },
                    lessonTitle: { type: Type.STRING, description: 'Tên bài dạy đầy đủ' },
                    semester: {
                      type: Type.STRING,
                      enum: ['Học kỳ I', 'Học kỳ II'],
                      description: 'Học kỳ',
                    },
                    category: { type: Type.STRING, description: 'Phân loại mảng kiến thức' },
                    note: { type: Type.STRING, description: 'Ghi chú thêm nếu có' },
                  },
                  required: ['periodNumber', 'lessonTitle'],
                },
              },
            },
            required: ['entries'],
          },
        },
      }
    );

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Mô hình AI không trả về dữ liệu.');
    }

    const parsedJson = JSON.parse(responseText);

    // Normalize canonical subjects and fill fallbacks
    const normalizeSubject = (s?: string) => {
      const trimmed = (s || '').trim();
      const upper = trimmed.toUpperCase();
      if (
        upper === 'HĐTNHN' ||
        upper === 'HDTNHN' ||
        upper === 'HĐTN' ||
        upper === 'HDTN' ||
        upper === 'HĐTN - HN' ||
        upper === 'HOẠT ĐỘNG TRẢI NGHIỆM, HƯỚNG NGHIỆP' ||
        upper === 'HOẠT ĐỘNG TRẢI NGHIỆM HƯỚNG NGHIỆP'
      ) {
        return 'HĐTN-HN';
      }
      return trimmed || activeSubject;
    };

    const mainSubject = normalizeSubject(parsedJson.subject);
    const mainGrade = parsedJson.grade || (Array.isArray(targetGrades) && targetGrades[0]) || defaultGrade || 10;

    const normalizedEntries = (parsedJson.entries || []).map((e: any) => {
      const rawTitle = typeof e.lessonTitle === 'string' ? e.lessonTitle.trim() : '';
      return {
        ...e,
        lessonTitle: rawTitle,
        subject: normalizeSubject(e.subject || mainSubject),
        grade: e.grade ? Number(e.grade) : mainGrade,
        semester: e.semester || parsedJson.semester || 'Học kỳ I',
        category: e.category || '',
        note: e.note || '',
      };
    });

    // Recompute detected subjects and grades
    const foundSubjects = Array.from(new Set(normalizedEntries.map((e: any) => e.subject)));
    const foundGrades = Array.from(new Set(normalizedEntries.map((e: any) => e.grade))).sort(
      (a: any, b: any) => a - b
    );

    return res.json({
      success: true,
      data: {
        ...parsedJson,
        subject: mainSubject,
        grade: mainGrade,
        detectedSubjects: foundSubjects.length > 0 ? foundSubjects : [mainSubject],
        detectedGrades: foundGrades.length > 0 ? foundGrades : [mainGrade],
        entries: normalizedEntries,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/parse-ppct:', error);
    return res.status(500).json({
      error: error.message || 'Lỗi xử lý trích xuất PPCT qua Gemini AI',
    });
  }
});

// Endpoint to parse Timetable (TKB) with Gemini
app.post('/api/parse-tkb', async (req, res) => {
  try {
    const {
      model: requestedModel,
      contentText,
      fileBase64,
      mimeType,
      fileName,
      targetWeek,
      startMondayDate,
    } = req.body;

    // ALWAYS prioritize user-provided API key from body or headers
    const { key: keyToUse, isUserKey } = resolveApiKey(req);

    if (!keyToUse) {
      return res.status(400).json({
        error: 'Chưa có API key Gemini. Vui lòng nhập API Key của bạn để sử dụng tính năng trích xuất AI.',
      });
    }

    console.log(`[Parse TKB] Nguồn API Key: ${isUserKey ? 'Khóa người dùng nạp vào (' + keyToUse.slice(0, 6) + '...)' : 'Khóa hệ thống'}`);

    const ai = new GoogleGenAI({
      apiKey: keyToUse,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemPrompt = `Bạn là chuyên gia phân tích và trích xuất Thời khóa biểu (TKB) giáo viên phổ thông, trung học, cao đẳng Việt Nam.
Nhiệm vụ của bạn là đọc kỹ bảng thời khóa biểu từ ảnh chụp (hoặc file Excel / Word / PDF / văn bản) và trích xuất thành danh sách các tiết dạy chuẩn xác theo các thứ trong tuần.

Các quy tắc phân tích bảng TKB Việt Nam:
1. Thông tin chung:
   - Tên giáo viên (teacherName): ví dụ "Nguyễn Văn Sang" từ "GV: Nguyễn Văn Sang"
   - Năm học (schoolYear): ví dụ "2025-2026"
   - Học kỳ (semester): "Học kỳ I" hoặc "Học kỳ II" (hoặc "Học kỳ 1" -> "Học kỳ I")
   - Ngày thực hiện / áp dụng (effectiveDate): ví dụ "21/9/2026" từ "Thực hiện từ: 21/9/2026"
   - Tuần áp dụng (detectedWeek): nếu trong văn bản có ghi "Tuần 2", "Tuần 1", v.v. Nếu không ghi trực tiếp số tuần, để trống hoặc ước lượng theo ngày thực hiện.

2. Cấu trúc bảng TKB:
   - Cột thứ: Thứ 2 (Thứ Hai) -> weekday=2, Thứ 3 -> weekday=3, Thứ 4 -> weekday=4, Thứ 5 -> weekday=5, Thứ 6 -> weekday=6, Thứ 7 -> weekday=7.
   - Buổi: Sáng -> session="morning", Chiều -> session="afternoon".
   - Tiết (period): 1, 2, 3, 4, 5. (Ví dụ: Buổi Chiều, Tiết 1 thì session="afternoon", period=1).
   - Nội dung ô TKB thường có dạng "[Lớp]-[Môn]" hoặc "[Lớp] [Môn]" (ví dụ: "10A8-HĐTN-HN", "10A8-Toán", "12B6-Toán", "12B1-Toán", "10A17-Toán", "10A8-Ôn Toán", "10A11-Toán", "10A15-Toán"):
     + className: Mã lớp, ví dụ "10A8", "12B6", "10A17", "10A11", "10A15", "12B1"...
     + subject: Tên môn học, ví dụ "Toán", "HĐTN-HN", "Ôn Toán", "Vật lí", "Hóa học", "Ngữ văn", "Tiếng Anh", "Tin học"...
     + activity: Các hoạt động trường lớp nếu có, ví dụ "Chào cờ", "Sinh hoạt lớp", "Khai giảng"... (Nếu là hoạt động thì className có thể để trống).
     + rawText: Giữ nguyên chuỗi văn bản trong ô (ví dụ: "10A8-HĐTN-HN").
   - Ô trống hoặc dấu gạch: Bỏ qua, KHÔNG tạo tiết.`;

    const contents: any[] = [];
    let extractedTextFromDoc = '';

    const lowerFileName = (fileName || '').toLowerCase();
    const effectiveMime = (mimeType || '').toLowerCase();

    // Check file type and process accordingly
    if (fileBase64) {
      const buffer = Buffer.from(fileBase64, 'base64');

      // 1. WORD DOCUMENT (.docx)
      if (
        lowerFileName.endsWith('.docx') ||
        effectiveMime.includes('wordprocessingml') ||
        effectiveMime.includes('msword')
      ) {
        try {
          const docxResult = await mammoth.convertToHtml({ buffer });
          extractedTextFromDoc = `[NỘI DUNG TÀI LIỆU WORD .DOCX ĐÃ TRÍCH XUẤT]:\n${docxResult.value}`;
        } catch {
          const rawResult = await mammoth.extractRawText({ buffer });
          extractedTextFromDoc = `[NỘI DUNG VĂN BẢN WORD .DOCX]:\n${rawResult.value}`;
        }
      }
      // 2. EXCEL SPREADSHEET (.xlsx, .xls, .xlsm, .csv)
      else if (
        lowerFileName.endsWith('.xlsx') ||
        lowerFileName.endsWith('.xls') ||
        lowerFileName.endsWith('.xlsm') ||
        lowerFileName.endsWith('.csv') ||
        effectiveMime.includes('spreadsheet') ||
        effectiveMime.includes('excel') ||
        effectiveMime.includes('csv')
      ) {
        try {
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetsText: string[] = [];
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            if (sheet) {
              const csvData = XLSX.utils.sheet_to_csv(sheet);
              if (csvData.trim()) {
                sheetsText.push(`--- BẢNG THỜI KHÓA BIỂU EXCEL (Sheet: ${sheetName}) ---\n${csvData}`);
              }
            }
          });
          extractedTextFromDoc = sheetsText.join('\n\n');
        } catch (excelErr: any) {
          throw new Error('Không thể đọc dữ liệu từ file Excel: ' + excelErr.message);
        }
      }
      // 3. PDF DOCUMENT (.pdf)
      else if (lowerFileName.endsWith('.pdf') || effectiveMime === 'application/pdf') {
        contents.push({
          inlineData: {
            data: fileBase64,
            mimeType: 'application/pdf',
          },
        });
      }
      // 4. IMAGES (.png, .jpg, .jpeg, .webp)
      else if (
        effectiveMime.startsWith('image/') ||
        ['.png', '.jpg', '.jpeg', '.webp', '.bmp'].some((ext) => lowerFileName.endsWith(ext))
      ) {
        const imageMime = effectiveMime.startsWith('image/')
          ? effectiveMime
          : lowerFileName.endsWith('.png')
          ? 'image/png'
          : 'image/jpeg';

        contents.push({
          inlineData: {
            data: fileBase64,
            mimeType: imageMime,
          },
        });
      }
      // 5. TEXT OR OTHER FORMATS
      else {
        try {
          const textStr = buffer.toString('utf-8');
          extractedTextFromDoc = `[NỘI DUNG TẬP TIN]:\n${textStr}`;
        } catch {
          contents.push({
            inlineData: {
              data: fileBase64,
              mimeType: 'application/pdf',
            },
          });
        }
      }
    }

    const partsText: string[] = [];

    if (contentText && contentText.trim()) {
      partsText.push(`Nội dung văn bản cung cấp:\n${contentText.trim()}`);
    }

    if (extractedTextFromDoc && extractedTextFromDoc.trim()) {
      partsText.push(`Dữ liệu bảng từ file đính kèm:\n${extractedTextFromDoc.trim()}`);
    }

    partsText.push(`Hãy trích xuất tất cả các tiết dạy trong bảng Thời khóa biểu trên.
- Tuần dự kiến đang xếp: Tuần ${targetWeek || 1}
- Ngày thứ 2 của tuần 1 trong năm học (nếu có để tính tuần): ${startMondayDate || 'chưa rõ'}`);

    contents.push({ text: partsText.join('\n\n') });

    const modelToUse = requestedModel || 'gemini-3.6-flash';
    const { response, usedModel, wasFallback } = await generateContentWithAutoFallback(
      ai,
      modelToUse,
      {
        contents: contents,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              teacherName: { type: Type.STRING, description: 'Tên giáo viên nếu có' },
              schoolYear: { type: Type.STRING, description: 'Năm học ví dụ 2025-2026' },
              semester: { type: Type.STRING, description: 'Học kỳ ví dụ Học kỳ I' },
              effectiveDate: { type: Type.STRING, description: 'Ngày bắt đầu thực hiện ví dụ 21/9/2026' },
              detectedWeek: { type: Type.INTEGER, description: 'Số tuần nếu nhận diện được (ví dụ: 2)' },
              slots: {
                type: Type.ARRAY,
                description: 'Danh sách các tiết dạy trong tuần',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    weekday: { type: Type.INTEGER, description: 'Thứ: 2 (Thứ 2), 3 (Thứ 3), 4, 5, 6, 7' },
                    session: {
                      type: Type.STRING,
                      enum: ['morning', 'afternoon'],
                      description: 'morning (sáng) hoặc afternoon (chiều)',
                    },
                    period: { type: Type.INTEGER, description: 'Tiết 1 đến 5' },
                    className: { type: Type.STRING, description: 'Tên lớp ví dụ 10A8, 12B6, 10A17' },
                    subject: { type: Type.STRING, description: 'Tên môn học ví dụ Toán, HĐTN-HN, Ôn Toán' },
                    activity: { type: Type.STRING, description: 'Hoạt động ví dụ Chào cờ, Sinh hoạt lớp nếu có' },
                    rawText: { type: Type.STRING, description: 'Văn bản gốc trong ô ví dụ 10A8-Toán' },
                    room: { type: Type.STRING, description: 'Phòng học nếu có' },
                    note: { type: Type.STRING, description: 'Ghi chú' },
                  },
                  required: ['weekday', 'session', 'period', 'rawText'],
                },
              },
            },
            required: ['slots'],
          },
        },
      }
    );

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Mô hình AI không trả về dữ liệu.');
    }

    const parsedJson = JSON.parse(responseText);
    return res.json({
      success: true,
      data: parsedJson,
    });
  } catch (error: any) {
    console.error('Error in /api/parse-tkb:', error);
    return res.status(500).json({
      error: error.message || 'Lỗi xử lý trích xuất Thời khóa biểu qua Gemini AI',
    });
  }
});

// Vite Middleware for development, Static serve for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

// Only start the standalone HTTP server when not running in Vercel serverless environment
if (process.env.VERCEL !== '1') {
  startServer();
}

export default app;

