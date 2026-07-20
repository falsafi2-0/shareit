// In-memory file chunks accumulator for received files

export interface ReceivedFile {
  name: string;
  size: number;
  chunks: ArrayBuffer[];
  receivedCount: number;
  totalChunks: number;
}

export class FileAssembler {
  private files: Map<string, ReceivedFile> = new Map();

  addChunk(
    name: string,
    size: number,
    index: number,
    total: number,
    data: ArrayBuffer,
  ): void {
    if (!this.files.has(name)) {
      this.files.set(name, {
        name,
        size,
        chunks: new Array(total),
        receivedCount: 0,
        totalChunks: total,
      });
    }
    const file = this.files.get(name)!;
    if (!file.chunks[index]) {
      file.chunks[index] = data;
      file.receivedCount++;
    }
  }

  isComplete(name: string): boolean {
    const file = this.files.get(name);
    return file ? file.receivedCount === file.totalChunks : false;
  }

  getFile(name: string): ReceivedFile | undefined {
    return this.files.get(name);
  }

  assembleAndDownload(name: string) {
    const file = this.files.get(name);
    if (!file) return;

    const blob = new Blob(file.chunks, { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clear() {
    this.files.clear();
  }
}
