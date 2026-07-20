import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface FilePickerProps {
  onFilesSelected: (files: File[]) => void;
  files: File[];
  onRemoveFile: (index: number) => void;
}

export function FilePicker({ onFilesSelected, files, onRemoveFile }: FilePickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        onFilesSelected(droppedFiles);
      }
    },
    [onFilesSelected],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) {
        onFilesSelected(selectedFiles);
      }
      e.target.value = '';
    },
    [onFilesSelected],
  );

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  if (files.length > 0) {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <FileText className="h-5 w-5 shrink-0 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
              </div>
              <button
                onClick={() => onRemoveFile(index)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
        >
          + Add more files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
        isDragging
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/50'
      }`}
    >
      <Upload
        className={`mb-4 h-12 w-12 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`}
      />
      <p className="text-lg font-medium text-gray-700">
        {isDragging ? 'Drop files here' : 'Select files to send'}
      </p>
      <p className="mt-1 text-sm text-gray-500">
        or drag & drop anywhere on this area
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}
