import { useState, useEffect } from "react";
import { Send, PlusCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ChatViewProps = {
  companyId?: string;
  onDocumentReference: (documentId: string, page: number) => void;
};

type Chat = {
  id: string;
  name: string;
  created_at: string;
};

type Message = {
  id: string;
  role: string;
  content:
    | {
        text: string;
        references: {
          documentId: string;
          page: string;
          text: string;
        }[];
      }
    | string;
  created_at: string;
};

export function ChatView({ companyId, onDocumentReference }: ChatViewProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchChats();
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (selectedChat && selectedChat !== "new") {
      fetchMessages(selectedChat);
    }
  }, [selectedChat]);

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

  const fetchChats = async () => {
    try {
      const response = await fetch("http://localhost:3023/chats");
      const data = await response.json();
      setChats(data);
    } catch (error) {
      console.error("Error fetching chats:", error);
      toast({
        title: "Error",
        description: "Failed to fetch chats",
        variant: "destructive",
      });
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const response = await fetch(`http://localhost:3023/messages/${chatId}`);
      const data = await response.json();
      setMessages(
        data.map((msg) => {
          let content;
          if (msg.role === "user") {
            content = {
              text: msg.content,
              references: [],
            };
          } else {
            const llmResponse = JSON.parse(msg.content);
            llmResponse.llmResponse = JSON.parse(llmResponse.llmResponse);
            content = {
              text: llmResponse.llmResponse.text,
              references: [],
            }
            const references = llmResponse.searchResults
              .filter((_: never, index: number) => llmResponse.llmResponse.references.includes(index))
              .map((result: any) => ({
                documentId: result.$meta.document_id,
                page: +result.$meta.page_id,
                text: result.$meta.chunk_text
              }));
            content.references = references;
          }
          return {
            ...msg,
            content,
          };
        })
      );
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch messages",
        variant: "destructive",
      });
      console.error("Error fetching messages:", error);
    }
  };

  const handleSendMessage = async () => {
    try {
      const response = await fetch("http://localhost:3023/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input, chatId: selectedChat }),
      });
      const data = await response.json();

      setMessages([...messages, data]);
      setInput("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      console.error("Error sending message:", error);
    }
  };

  if (!selectedChat) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:bg-accent"
          onClick={() => setSelectedChat("new")}
        >
          <CardHeader>
            <CardTitle>
              <span className="flex gap-2 items-center">
                <PlusCircle className="h-4 w-4" /> New Chat
              </span>
            </CardTitle>
            <CardDescription>Start a new chat</CardDescription>
          </CardHeader>
        </Card>

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
          <CardTitle className="flex items-center justify-between">
            Chats
            <Button onClick={() => setSelectedChat("new")} variant="outline">
              <PlusCircle className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {selectedChat === "new" ? (
              <div
                key="new"
                className={`p-2 rounded-lg cursor-pointer bg-primary text-primary-foreground`}
                onClick={() => setSelectedChat("new")}
              >
                <span className="flex gap-2 items-center">New Chat</span>
              </div>
            ) : null}
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`p-2 rounded-lg cursor-pointer ${
                  chat.id === selectedChat
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
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
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`rounded-lg p-4 max-w-[80%] ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p>{message.content.text}</p>
                    {message.content.references?.map((ref, index) => (
                      <div
                        key={index}
                        className="mt-2 p-2 bg-white rounded cursor-pointer text-xs shadow-sm hover:shadow-md transition-shadow"
                        onClick={() =>
                          onDocumentReference(ref.documentId, ref.page)
                        }
                      >
                        ...{ref.text}...
                        <span className="mt-2 flex items-center gap-1 text-muted-foreground">
                          <BookOpen className="h-4 w-4" />
                          Page {ref.page} of {documents.find((doc) => doc.id === ref.documentId)?.name}
                        </span>
                      </div>
                    ))}
                    <div className="text-xs mt-1 opacity-70">
                      {new Date(message.created_at).toLocaleString()}
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
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button onClick={handleSendMessage} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
