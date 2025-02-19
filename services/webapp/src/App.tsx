import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentList } from '@/components/DocumentList';
import { ChatView } from '@/components/ChatView';
import { CompanySelector } from '@/components/CompanySelector';
import { UserMenu } from '@/components/UserMenu';
import { Toaster } from '@/components/ui/toaster';

export type Company = {
  id: string;
  name: string;
};

function App() {
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("documents");
  const [highlight, setHighlight] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background w-full">
      <main className="px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            <DocumentList
              activeDocumentId={activeDocumentId}
              setActiveDocumentId={setActiveDocumentId}
              activePage={activePage}
              highlight={highlight}
              setHighlight={setHighlight}
              onClose={() => {
                setActiveDocumentId(null);
                setActivePage(null);
              }}
            />
          </TabsContent>

          <TabsContent value="chats" className="space-y-4">
            <ChatView
              onDocumentReference={(documentId, page, highlight) => {
                setActiveDocumentId(documentId);
                setActivePage(page);
                setHighlight(highlight);
                setActiveTab("documents");
              }}
            />
          </TabsContent>
        </Tabs>
        <Toaster />
      </main>
    </div>
  );
}

export default App;