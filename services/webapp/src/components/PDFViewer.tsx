import { useCallback, useState, useEffect } from "react";
import { useResizeObserver } from "@wojtekmaj/react-hooks";
import { pdfjs, Document, Page } from "react-pdf";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useToast } from "@/hooks/use-toast";

const options = {
  cMapUrl: "/cmaps/",
  standardFontDataUrl: "/standard_fonts/",
};

const resizeObserverOptions = {};
const maxWidth = 800;

interface PDFViewerProps {
  documentId: string;
  highlight: string | null;
  initialPage?: number;
}

type Page = {
  id: string;
  page_number: number;
  content: string;
};

const highlightText = (text: string, searchTerm: string | null) => {
  if (!searchTerm || !text) return text;
  
  // Clean and split the search term into words
  const words = searchTerm
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove all non-word characters except spaces
    .split(/\s+/) // Split on whitespace
    .filter(word => word.length > 0); // Remove empty strings
  
  let highlightedText = text;
  
  // Only create groups of 3 words
  for (let i = 0; i <= words.length - 3; i++) {
    const phrase = words.slice(i, i + 3).join(' ');
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
  }
  
  return highlightedText;
};

export function PDFViewer({ documentId, initialPage = 1, highlight }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>();
  const [pages, setPages] = useState<Page[]>([]);
  const [tab, setTab] = useState<"pdf" | "text">("pdf");
  const { toast } = useToast();

  useEffect(() => {
    setTab(highlight ? "text" : "pdf");
  }, [highlight]);

  useEffect(() => {
    fetch(`http://localhost:3023/pages/${documentId}`)
      .then((response) => response.json())
      .then(setPages)
      .catch((error) => {
        console.error("Error fetching pages:", error);
        toast({
          title: "Error",
          description: "Failed to fetch pages",
          variant: "destructive",
        });
      });
  }, [documentId]);

  const onResize = useCallback<ResizeObserverCallback>((entries) => {
    const [entry] = entries;
    if (entry) {
      setContainerWidth(entry.contentRect.width);
    }
  }, []);

  useResizeObserver(containerRef, resizeObserverOptions, onResize);

  function onDocumentLoadSuccess({ numPages }: PDFDocumentProxy): void {
    setNumPages(numPages);
    setLoading(false);
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || prev));
  };

  const components = {
    p: ({ children }: { children: React.ReactNode }) => {
      if (typeof children === 'string') {
        return (
          <p 
            dangerouslySetInnerHTML={{ 
              __html: highlightText(children, highlight) 
            }} 
          />
        );
      }
      return <p>{children}</p>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs value={tab} onValueChange={(tab) => setTab(tab as "pdf" | "text")} className="flex-1 flex flex-col">
        <TabsList className="mx-2 mt-2">
          <TabsTrigger value="pdf">PDF View</TabsTrigger>
          <TabsTrigger value="text">Text View</TabsTrigger>
        </TabsList>

        <TabsContent value="pdf" className="flex-1 relative">
          <div className="absolute inset-0 overflow-y-auto">
            <div
              className="flex flex-col items-center gap-4 p-4"
              ref={setContainerRef}
            >
              <div>
                <Document
                  file={`http://localhost:3023/documents/${documentId}`}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="text-center p-4">Loading PDF...</div>
                  }
                  error={
                    <div className="text-center text-red-500 p-4">
                      Failed to load PDF
                    </div>
                  }
                  options={options}
                >
                  <Page
                    pageNumber={pageNumber}
                    width={
                      containerWidth
                        ? Math.min(containerWidth - 32, maxWidth)
                        : maxWidth
                    }
                    className="max-w-full"
                  />
                </Document>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="text" className="flex-1 relative">
          <div className="absolute inset-0 overflow-y-auto">
            <div className="p-4">
              <Markdown 
                remarkPlugins={[remarkGfm]}
                components={components}
              >
                {pages.find((page) => page.page_number + 1 === pageNumber)?.content}
              </Markdown>
            </div>
          </div>
        </TabsContent>

        {!loading && numPages && (
          <div className="flex items-center gap-4 p-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[100px] text-center">
              Page {pageNumber} of {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={pageNumber >= (numPages || 0)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Tabs>
    </div>
  );
}
