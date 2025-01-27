import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Mock data
const chats = [
  { id: '1', name: 'Financial Analysis' },
  { id: '2', name: 'Product Research' },
  { id: '3', name: 'Market Overview' },
];

const mockMessages = [
  {
    id: '1',
    role: 'user',
    content: 'What were our Q4 revenue numbers?',
    timestamp: '10:30 AM',
  },
  {
    id: '2',
    role: 'assistant',
    content: 'Based on the Q4 Analysis document, the revenue numbers were $10.5M.',
    references: [
      {
        documentId: '2',
        page: 5,
        text: 'Q4 2023 revenue reached $10.5M, showing a 15% YoY growth.',
      },
    ],
    timestamp: '10:31 AM',
  },
];

type ChatViewProps = {
  companyId?: string;
  onDocumentReference: (documentId: string, page: number) => void;
};

export function ChatView({ companyId, onDocumentReference }: ChatViewProps) {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [input, setInput] = useState('');

  if (!selectedChat) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {chats.map((chat) => (
          <Card
            key={chat.id}
            className="cursor-pointer hover:bg-accent"
            onClick={() => setSelectedChat(chat.id)}
          >
            <CardHeader>
              <CardTitle>{chat.name}</CardTitle>
              <CardDescription>Click to continue chat</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[300px_1fr] gap-4 h-[calc(100vh-12rem)]">
      <Card>
        <CardHeader>
          <CardTitle>Chats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`p-2 rounded-lg cursor-pointer ${
                  chat.id === selectedChat
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
                onClick={() => setSelectedChat(chat.id)}
              >
                {chat.name}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 flex flex-col h-full">
          <ScrollArea className="flex-1 pr-4 mb-4">
            <div className="space-y-4">
              {mockMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`rounded-lg p-4 max-w-[80%] ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p>{message.content}</p>
                    {message.references?.map((ref, index) => (
                      <div
                        key={index}
                        className="mt-2 p-2 bg-accent rounded cursor-pointer text-sm"
                        onClick={() =>
                          onDocumentReference(ref.documentId, ref.page)
                        }
                      >
                        {ref.text}
                      </div>
                    ))}
                    <div className="text-xs mt-1 opacity-70">
                      {message.timestamp}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // Handle send
                  setInput('');
                }
              }}
            />
            <Button size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}