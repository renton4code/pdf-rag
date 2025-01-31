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
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("documents");
  const [highlight, setHighlight] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background w-full">
      <header className="border-b">
        <div className="px-6 h-16 flex items-center justify-between">
          <CompanySelector
            value={selectedCompany}
            onChange={setSelectedCompany}
          />
          <div className="flex items-center gap-4">
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            <DocumentList
              companyId={selectedCompany?.id}
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
              companyId={selectedCompany?.id}
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