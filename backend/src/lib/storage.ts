import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, unlink, readFile, writeFile } from 'node:fs/promises';
import { env } from '../config/env';

// Abstração de armazenamento de arquivo. A implementação de hoje grava em
// disco local (volume Docker); trocar por S3 depois significa só escrever
// uma nova classe com essa mesma interface e trocar o export de
// `defaultStorage` abaixo — nada no resto do código muda.
export interface FileStorage {
  /** Salva o arquivo e retorna o "caminho" a ser persistido no banco (nunca a URL final). */
  save(buffer: Buffer, originalName: string, subfolder: string): Promise<string>;
  read(storedPath: string): Promise<Buffer>;
  delete(storedPath: string): Promise<void>;
}

class LocalDiskStorage implements FileStorage {
  private baseDir = path.resolve(env.UPLOADS_DIR);

  async save(buffer: Buffer, originalName: string, subfolder: string): Promise<string> {
    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const relativePath = path.join(subfolder, filename);
    const fullDir = path.join(this.baseDir, subfolder);

    await mkdir(fullDir, { recursive: true });
    await writeFile(path.join(this.baseDir, relativePath), buffer);

    return relativePath.split(path.sep).join('/'); // caminho sempre com "/" no banco, independente do SO
  }

  async read(storedPath: string): Promise<Buffer> {
    return readFile(path.join(this.baseDir, storedPath));
  }

  async delete(storedPath: string): Promise<void> {
    try {
      await unlink(path.join(this.baseDir, storedPath));
    } catch {
      // arquivo já não existe — não é um erro que deva derrubar a operação
    }
  }
}

export const defaultStorage: FileStorage = new LocalDiskStorage();
