import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
dotenv.config();
// Desabilitar o body parser padrão do Next.js para permitir upload de arquivos
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Configurar formidable para processar o upload
    const form = formidable({
      uploadDir: process.env.UPLOAD_DIR || os.tmpdir(),
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB (arquivos de retorno podem ser grandes)
      maxTotalFileSize: 50 * 1024 * 1024, // 50MB total
      filename: (name, ext, part, form) => {
        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `${timestamp}-${random}${ext}`;
      },
    });

    // Escolher diretório temporário: UPLOAD_DIR (se definido) ou o diretório tmp do SO
    const tempDir = process.env.UPLOAD_DIR || os.tmpdir();
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      // Verificar permissão de escrita
      fs.accessSync(tempDir, fs.constants.W_OK);
    } catch (err) {
      console.error(`Não é possível criar/escrever em tempDir (${tempDir}):`, err);
      throw err;
    }

    // Processar o upload
    const [fields, files] = await form.parse(req);

    // Verificar se um arquivo foi enviado
    const file = files.file?.[0];
    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    // Verificar tipo do arquivo (apenas .txt e .ret permitidos)
    const allowedExtensions = ['.txt', '.ret'];
    const fileExtension = path.extname(file.originalFilename || '').toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      // Remover arquivo inválido
      fs.unlinkSync(file.filepath);
      return res.status(400).json({
        error: 'Tipo de arquivo não permitido. Apenas arquivos .txt e .ret são aceitos.'
      });
    }

    // Retornar informações do arquivo
    const fileInfo = {
      originalName: file.originalFilename,
      filePath: file.filepath,
      size: file.size,
      mimeType: file.mimetype,
    };

    res.status(200).json({
      success: true,
      message: 'Arquivo enviado com sucesso',
      filePath: file.filepath,
      fileInfo: fileInfo,
    });

  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}