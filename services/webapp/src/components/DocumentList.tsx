import { useState, useRef, useEffect } from 'react';
import { FileText, Upload, Loader2, Trash, Clock, CheckCircle, XCircle, ScanEye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

const STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
}

// Update DocumentListProps
type DocumentListProps = {
  activePage: number | null;
};

// Update the mock data section with real data fetching
interface Document {
  id: string;
  name: string;
  status: string;
  format: string;
}

export function DocumentList({
  activePage,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [forceOCR, setForceOCR] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch documents on component mount and every 5 seconds
  useEffect(() => {
    // Initial fetch
    fetchDocuments();

    // Set up polling interval
    const interval = setInterval(() => {
      fetchDocuments();
    }, 5000);

    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('http://localhost:3023/documents');
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        variant: 'destructive',
      });
    }
  };

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);

      const url = new URL('http://localhost:3023/documents');
      if (forceOCR) {
        url.searchParams.append('force_ocr', 'true');
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      toast({
        title: 'Success',
        description: `Uploaded ${files.length} document(s)`,
      });
      
      // Refresh document list
      await fetchDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      await fetch(`http://localhost:3023/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      toast({
        title: 'Success',
        description: 'Document deleted',
      });
      
      // Refresh document list
      await fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleUpload(files);
      await fetchDocuments();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleUpload(files);
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getStatus = (status: string) => {
    if (status === STATUSES.PENDING) {
      return (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>Pending</span>
        </div>
      );
    } else if (status === STATUSES.PROCESSING) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Processing</span>
        </div>
      );
    } else if (status === STATUSES.COMPLETED) {
      return (
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>Completed</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-500" />
          <span>Failed</span>
        </div>
      );
    }
  }

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
            <div className="flex items-center space-x-2 mt-4">
              <Switch
                id="force-ocr"
                checked={forceOCR}
                onCheckedChange={setForceOCR}
              />
              <Label htmlFor="force-cv" className="flex items-center gap-2">
                <ScanEye className="h-4 w-4" />
                Force OCR (slow)
              </Label>
            </div>
          </div>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Index Status</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium">{doc.name}</TableCell>
              <TableCell>{getStatus(doc.status)}</TableCell>
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
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(doc.id)}
                >
                  <Trash className="h-4 w-4" />
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
                url={`http://localhost:3023/documents/${documents.find(doc => doc.id === activeDocumentId)?.id}`} 
                initialPage={activePage || 1}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}