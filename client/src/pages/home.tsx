import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/image-upload";
import { ImageCanvas } from "@/components/image-canvas";
import { type BoundingBox } from "@shared/schema";
import { Download, ChevronLeft, ChevronRight, Undo2, Redo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JSZip from 'jszip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ImageData {
  file: File;
  dataUrl: string;
  boundingBoxes: BoundingBox[];
  history: BoundingBox[][];
  currentHistoryIndex: number;
}

type ExportFormat = 'png' | 'jpeg' | 'webp';

interface LabelSeries {
  id: string;
  name: string;
  labels: string;
}

const Home: React.FC = () => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [labelSeries, setLabelSeries] = useState<LabelSeries[]>([
    { id: '1', name: 'Series 1', labels: '' }
  ]);
  const [currentSeriesId, setCurrentSeriesId] = useState<string>('1');
  const { toast } = useToast();

  const handleImagesUpload = (files: FileList) => {
    const newImages: ImageData[] = [];

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newImages.push({
          file,
          dataUrl: e.target?.result as string,
          boundingBoxes: [],
          history: [[]],
          currentHistoryIndex: 0
        });
        if (newImages.length === files.length) {
          setImages(newImages);
          setCurrentImageIndex(0);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleBoxDrawn = (box: BoundingBox) => {
    setImages(prev => {
      const updated = [...prev];
      const currentImage = { ...updated[currentImageIndex] };

      const newHistory = currentImage.history.slice(0, currentImage.currentHistoryIndex + 1);
      const newBoxes = [...currentImage.boundingBoxes, box];

      currentImage.history = [...newHistory, newBoxes];
      currentImage.currentHistoryIndex = currentImage.history.length - 1;
      currentImage.boundingBoxes = newBoxes;

      updated[currentImageIndex] = currentImage;
      return updated;
    });
  };

  const handleUndo = () => {
    setImages(prev => {
      const updated = [...prev];
      const currentImage = { ...updated[currentImageIndex] };

      if (currentImage.currentHistoryIndex > 0) {
        currentImage.currentHistoryIndex--;
        currentImage.boundingBoxes = currentImage.history[currentImage.currentHistoryIndex];
        updated[currentImageIndex] = currentImage;
      }

      return updated;
    });
  };

  const handleRedo = () => {
    setImages(prev => {
      const updated = [...prev];
      const currentImage = { ...updated[currentImageIndex] };

      if (currentImage.currentHistoryIndex < currentImage.history.length - 1) {
        currentImage.currentHistoryIndex++;
        currentImage.boundingBoxes = currentImage.history[currentImage.currentHistoryIndex];
        updated[currentImageIndex] = currentImage;
      }

      return updated;
    });
  };

  const handleLabelsChange = (newLabels: string) => {
    setLabelSeries(prev => prev.map(series =>
      series.id === currentSeriesId ? { ...series, labels: newLabels } : series
    ));
  };

  const handleDeleteBox = (boxIndex: number) => {
    setImages(prev => {
      const updated = [...prev];
      const currentImage = { ...updated[currentImageIndex] };

      const newBoxes = currentImage.boundingBoxes.filter((_, idx) => idx !== boxIndex);
      const newHistory = [...currentImage.history.slice(0, currentImage.currentHistoryIndex + 1), newBoxes];

      currentImage.boundingBoxes = newBoxes;
      currentImage.history = newHistory;
      currentImage.currentHistoryIndex = newHistory.length - 1;

      updated[currentImageIndex] = currentImage;
      return updated;
    });
  };

  const handleDeleteImage = () => {
    setImages(prev => {
      const updated = [...prev];
      updated.splice(currentImageIndex, 1);
      setCurrentImageIndex(Math.min(currentImageIndex, updated.length - 1));
      return updated;
    });
  };

  const addLabelSeries = () => {
    const newId = (labelSeries.length + 1).toString();
    setLabelSeries(prev => [...prev, {
      id: newId,
      name: `Series ${newId}`,
      labels: ''
    }]);
    setCurrentSeriesId(newId);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExport = async () => {
    if (!images[currentImageIndex]) return;

    const { boundingBoxes, file, dataUrl } = images[currentImageIndex];
    if (boundingBoxes.length === 0) {
      toast({
        title: "No regions selected",
        description: "Please draw at least one bounding box before exporting",
        variant: "destructive"
      });
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast({
        title: "Error",
        description: "Could not initialize canvas context",
        variant: "destructive"
      });
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const baseFilename = file.name.substring(0, file.name.lastIndexOf('.'));
      const currentSeries = labelSeries.find(s => s.id === currentSeriesId);
      const labelsList = currentSeries?.labels ? currentSeries.labels.split(',').map(l => l.trim()) : [];

      const zip = new JSZip();
      const folder = zip.folder(baseFilename);
      if (!folder) throw new Error("Could not create zip folder");

      const processedFiles = [];
      for (let i = 0; i < boundingBoxes.length; i++) {
        const box = boundingBoxes[i];
        const label = labelsList[i];
        if (!label) continue;

        canvas.width = box.width;
        canvas.height = box.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          img,
          box.x, box.y, box.width, box.height,
          0, 0, box.width, box.height
        );

        let mimeType = 'image/png';
        let quality = 1.0;

        switch (exportFormat) {
          case 'jpeg':
            mimeType = 'image/jpeg';
            quality = 0.92;
            break;
          case 'webp':
            mimeType = 'image/webp';
            quality = 0.92;
            break;
        }

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Failed to create blob"));
            },
            mimeType,
            quality
          );
        });

        processedFiles.push({ label, blob });
      }

      processedFiles.forEach(({ label, blob }) => {
        folder.file(`${label}.${exportFormat}`, blob);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(content);
      downloadLink.download = `${baseFilename}.zip`;
      downloadLink.click();
      URL.revokeObjectURL(downloadLink.href);

      toast({
        title: "Export complete",
        description: `Exported ${processedFiles.length} labeled regions to ${baseFilename}.zip`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export images",
        variant: "destructive"
      });
    }
  };

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => Math.min(images.length - 1, prev + 1));
  };

  const currentImage = images[currentImageIndex];
  const canUndo = currentImage?.currentHistoryIndex > 0;
  const canRedo = currentImage?.currentHistoryIndex < (currentImage?.history.length - 1);
  const currentSeriesLabels = labelSeries.find(s => s.id === currentSeriesId)?.labels || '';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1920px] mx-auto">
        <Card className="rounded-none border-x-0 shadow-none">
          <CardHeader className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75 sticky top-0 z-10 px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-semibold tracking-tight">Text Region Cropper</CardTitle>
              {images.length > 0 && (
                <div className="flex items-center gap-6">
                  <div className="text-sm font-medium">
                    <span className="text-muted-foreground">
                      Image {currentImageIndex + 1} of {images.length}
                    </span>
                    <span className="ml-2 text-foreground/90">
                      {currentImage?.file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        onClick={handleUndo}
                        disabled={!canUndo}
                        size="sm"
                        title="Undo (Ctrl+Z)"
                        className="transition-colors"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleRedo}
                        disabled={!canRedo}
                        size="sm"
                        title="Redo (Ctrl+Y)"
                        className="transition-colors"
                      >
                        <Redo2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          onClick={handlePrevImage}
                          disabled={currentImageIndex === 0}
                          size="sm"
                          className="transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleNextImage}
                          disabled={currentImageIndex === images.length - 1}
                          size="sm"
                          className="transition-colors"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Select
                          value={exportFormat}
                          onValueChange={(value) => setExportFormat(value as ExportFormat)}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="png">PNG</SelectItem>
                            <SelectItem value="jpeg">JPEG</SelectItem>
                            <SelectItem value="webp">WebP</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleExport}
                          size="sm"
                          className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export Regions
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {images.length === 0 ? (
              <div className="p-8">
                <div className="max-w-2xl mx-auto">
                  <ImageUpload onUpload={handleImagesUpload} />
                </div>
              </div>
            ) : (
              <ImageCanvas
                imageData={currentImage?.dataUrl}
                onBoxDrawn={handleBoxDrawn}
                boundingBoxes={currentImage?.boundingBoxes || []}
                onDeleteBox={handleDeleteBox}
                onDeleteImage={handleDeleteImage}
                onLabelsChange={handleLabelsChange}
                labels={currentSeriesLabels}
                labelSeries={labelSeries}
                currentSeriesId={currentSeriesId}
                onAddLabelSeries={addLabelSeries}
                onSelectLabelSeries={setCurrentSeriesId}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;