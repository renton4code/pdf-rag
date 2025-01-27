import { useState, useRef } from 'react';
import { FileText, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PDFViewer } from '@/components/PDFViewer';

// Mock data
const documents = [
  { 
    id: '1', 
    name: 'Annual Report 2023.pdf', 
    uploadedAt: '2024-03-20',
    url: 'https://pdfobject.com/pdf/sample.pdf'
  },
];

type DocumentListProps = {
  companyId?: string;
  openedDocumentId: string | null;
  activePage: number | null;
};

export function DocumentList({
  companyId,
  openedDocumentId,
  initialPage,
}: DocumentListProps) {
  const [uploading, setUploading] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setUploading(true);
      // Simulate upload delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setUploading(false);
      toast({
        title: 'Success',
        description: `Uploaded ${files.length} document(s)`,
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploading(true);
      // Simulate upload delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setUploading(false);
      toast({
        title: 'Success',
        description: `Uploaded ${files.length} document(s)`,
      });
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Uploading document...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8" />
            <p>Drag and drop documents here or</p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
              accept=".pdf"
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              Select Files
            </Button>
          </div>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium">{doc.name}</TableCell>
              <TableCell>{doc.uploadedAt}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Simulate opening document
                    toast({
                      title: 'Opening document',
                      description: doc.name,
                    });
                    setActiveDocumentId(doc.id);
                  }}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={activeDocumentId !== null} onOpenChange={() => { setActiveDocumentId(null); }}>
        <DialogContent className="max-w-4xl h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {documents.find(doc => doc.id === activeDocumentId)?.name || 'Document Viewer'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-muted rounded-lg overflow-hidden">
            {activeDocumentId && (
              <PDFViewer 
                url={documents.find(doc => doc.id === activeDocumentId)?.url || ''} 
                initialPage={initialPage || 1}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}