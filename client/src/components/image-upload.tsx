import { useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Upload } from 'lucide-react';

interface ImageUploadProps {
  onUpload: (files: FileList) => void;
}

export function ImageUpload({ onUpload }: ImageUploadProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onUpload(files);
      }
    },
    [onUpload]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onUpload(files);
      }
    },
    [onUpload]
  );

  return (
    <Card
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="border-dashed border-2 p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <div className="flex flex-col items-center space-y-4">
        <Upload className="h-12 w-12 text-muted-foreground" />
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Upload Images</h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop your images here, or click to select files
          </p>
        </div>
      </div>
      <input
        id="file-upload"
        type="file"
        multiple
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
    </Card>
  );
}
