import { useEffect, useRef, useState } from 'react';
import type { BoundingBox } from '@shared/schema';
import { Slider } from "@/components/ui/slider";
import { ZoomInIcon, ZoomOutIcon, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ImageCanvasProps {
  imageData: string;
  onBoxDrawn: (box: BoundingBox) => void;
  boundingBoxes: BoundingBox[];
  onDeleteBox?: (index: number) => void;
  onDeleteImage?: () => void;
  onLabelsChange?: (labels: string) => void;
  labels?: string;
  labelSeries: Array<{ id: string; name: string; labels: string }>;
  currentSeriesId: string;
  onAddLabelSeries: () => void;
  onSelectLabelSeries: (id: string) => void;
}

export function ImageCanvas({
  imageData,
  onBoxDrawn,
  boundingBoxes,
  onDeleteBox,
  onDeleteImage,
  onLabelsChange,
  labels = '',
  labelSeries,
  currentSeriesId,
  onAddLabelSeries,
  onSelectLabelSeries,
}: ImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.3);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);
  const [hoveredBoxIndex, setHoveredBoxIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = Math.max(1, img.width * zoom);
      canvas.height = Math.max(1, img.height * zoom);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);

      ctx.drawImage(img, 0, 0, img.width, img.height);

      boundingBoxes.forEach((box, index) => {
        const isSelected = index === selectedBoxIndex;
        const isHovered = index === hoveredBoxIndex;

        ctx.strokeStyle = isSelected ? '#ef4444' : isHovered ? '#3b82f6' : '#0ea5e9';
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        if (isHovered) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
          ctx.fillRect(box.x, box.y, box.width, box.height);
        }
      });

      ctx.restore();

      if (isDrawing) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.min(startPos.x, currentPos.x);
        const y = Math.min(startPos.y, currentPos.y);
        const width = Math.abs(currentPos.x - startPos.x);
        const height = Math.abs(currentPos.y - startPos.y);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(x, y, width, height);
        ctx.restore();
      }
    };
    img.src = imageData;
  };

  const updatePreview = (box: BoundingBox) => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas || !imageData) return;

    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const maxPreviewWidth = 200;
      const maxPreviewHeight = 150;
      const aspectRatio = box.width / box.height;

      let previewWidth = maxPreviewWidth;
      let previewHeight = previewWidth / aspectRatio;

      if (previewHeight > maxPreviewHeight) {
        previewHeight = maxPreviewHeight;
        previewWidth = previewHeight * aspectRatio;
      }

      previewCanvas.width = previewWidth;
      previewCanvas.height = previewHeight;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

      ctx.drawImage(
        img,
        box.x, box.y, box.width, box.height,
        0, 0, previewWidth, previewHeight
      );

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, previewWidth, previewHeight);
    };
    img.src = imageData;
  };

  useEffect(() => {
    redrawCanvas();
  }, [imageData, boundingBoxes, isDrawing, startPos, currentPos, zoom, offset, selectedBoxIndex, hoveredBoxIndex]);

  useEffect(() => {
    if (hoveredBoxIndex !== null && boundingBoxes[hoveredBoxIndex]) {
      updatePreview(boundingBoxes[hoveredBoxIndex]);
    }
  }, [hoveredBoxIndex, boundingBoxes, imageData]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }

    const coords = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPos(coords);
    setCurrentPos(coords);

    const canvasX = (coords.x - offset.x) / zoom;
    const canvasY = (coords.y - offset.y) / zoom;

    const clickedBoxIndex = boundingBoxes.findIndex(box =>
      canvasX >= box.x &&
      canvasX <= box.x + box.width &&
      canvasY >= box.y &&
      canvasY <= box.y + box.height
    );

    setSelectedBoxIndex(clickedBoxIndex >= 0 ? clickedBoxIndex : null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }

    if (!isDrawing) {
      const coords = getCanvasCoordinates(e);
      const canvasX = (coords.x - offset.x) / zoom;
      const canvasY = (coords.y - offset.y) / zoom;

      const hoveredBox = boundingBoxes.findIndex(box =>
        canvasX >= box.x &&
        canvasX <= box.x + box.width &&
        canvasY >= box.y &&
        canvasY <= box.y + box.height
      );

      setHoveredBoxIndex(hoveredBox >= 0 ? hoveredBox : null);
      return;
    }

    const coords = getCanvasCoordinates(e);
    setCurrentPos(coords);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    const coords = getCanvasCoordinates(e);
    setCurrentPos(coords);

    const width = Math.abs(coords.x - startPos.x) / zoom;
    const height = Math.abs(coords.y - startPos.y) / zoom;

    if (width > 5 && height > 5) {
      const x = (Math.min(startPos.x, coords.x) - offset.x) / zoom;
      const y = (Math.min(startPos.y, coords.y) - offset.y) / zoom;

      const box: BoundingBox = {
        x,
        y,
        width,
        height
      };
      onBoxDrawn(box);
    }
  };

  const handleMouseLeave = () => {
    setHoveredBoxIndex(null);
  };

  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

  const handleDeleteSelected = () => {
    if (selectedBoxIndex !== null && onDeleteBox) {
      onDeleteBox(selectedBoxIndex);
      setSelectedBoxIndex(null);
    }
  };

  const labelsList = labels ? labels.split(',').map(l => l.trim()) : [];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex flex-col gap-2 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ZoomOutIcon className="w-4 h-4 text-muted-foreground" />
            <Slider
              defaultValue={[0.3]}
              min={0}
              max={4}
              step={0.1}
              value={[zoom]}
              onValueChange={handleZoomChange}
              className="w-48"
            />
            <ZoomInIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground ml-2">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={selectedBoxIndex === null}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Box
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDeleteImage}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Image
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={currentSeriesId} onValueChange={onSelectLabelSeries}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select series" />
            </SelectTrigger>
            <SelectContent>
              {labelSeries.map(series => (
                <SelectItem key={series.id} value={series.id}>
                  {series.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddLabelSeries}
            className="whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Series
          </Button>
          <Input
            placeholder="Labels (comma separated)"
            value={labels}
            onChange={(e) => onLabelsChange?.(e.target.value)}
            className="flex-1"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted/10" ref={containerRef}>
        <div className="min-w-fit min-h-fit relative">
          <TooltipProvider>
            <Tooltip open={hoveredBoxIndex !== null && boundingBoxes[hoveredBoxIndex] !== undefined}>
              <TooltipTrigger asChild>
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onContextMenu={(e) => e.preventDefault()}
                  className="cursor-crosshair shadow-lg transition-shadow"
                />
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-background/95 backdrop-blur-sm border shadow-lg p-2"
                style={{
                  position: 'absolute',
                  left: `${tooltipPosition.x + 20}px`,
                  top: `${tooltipPosition.y}px`,
                  zIndex: 50,
                }}
              >
                <div className="space-y-2">
                  {hoveredBoxIndex !== null && boundingBoxes[hoveredBoxIndex] && (
                    <>
                      <p className="text-sm font-medium">
                        {labelsList[hoveredBoxIndex] || 'Unlabeled Region'}
                      </p>
                      <canvas
                        ref={previewCanvasRef}
                        className="rounded-sm shadow-sm"
                      />
                    </>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}