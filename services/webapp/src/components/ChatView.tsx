import { useState, useEffect, useRef } from "react";
import { Send, PlusCircle, BookOpen, Loader2, Filter } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatViewProps = {
  companyId?: string;
  onDocumentReference: (
    documentId: string,
    page: number,
    highlight: string | null
  ) => void;
};

type Chat = {
  id: string;
  name: string;
  created_at: string;
};

type Message = {
  id: string;
  role: string;
  content: {
    text: string;
    references: {
      documentId: string;
      page: number;
      text: string;
    }[];
  };
  created_at: string;
};

type Document = {
  id: string;
  name: string;
};

export function ChatView({ onDocumentReference }: ChatViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChats();
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (selectedChat && selectedChat !== "new") {
      fetchMessages(selectedChat);
    } else if (selectedChat === "new") {
      setMessages([]);
    }
  }, [selectedChat]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch("http://localhost:3023/documents");
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Error",
        description: "Failed to fetch documents",
        variant: "destructive",
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

  const parseMessage = (msg: any): Message => {
    let content;
    if (msg.role === "user") {
      content = {
        text: msg.content,
        references: [],
      };
    } else {
      const llmResponse = JSON.parse(msg.content);
      content = {
        text: llmResponse.llmResponse.text,
        references: [],
      };
      const references = llmResponse.searchResults
        .filter((_: never, index: number) =>
          llmResponse.llmResponse.references.includes(index + 1)
        )
        .map((result: any) => ({
          documentId: result.$meta.document_id,
          page: +result.$meta.page_id + 1,
          text: result.$meta.chunk_text,
        }))
        .sort((a: any, b: any) => a.page - b.page);
      content.references = references;
    }
    return {
      ...msg,
      content,
    };
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const response = await fetch(`http://localhost:3023/messages/${chatId}`);
      const data = await response.json();
      setMessages(data.map(parseMessage));
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
    if (!input) return;

    try {
      setIsLoading(true);
      const messagesWithQuery = [
        ...messages,
        {
          id: (messages.length + 1).toString(),
          role: "user",
          content: {
            text: input,
            references: [],
          },
          created_at: new Date().toISOString(),
        },
      ];
      setMessages(messagesWithQuery);
      const response = await fetch("http://localhost:3023/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input,
          chatId: selectedChat,
          documents: selectedDocuments,
        }),
      });
      const data = await response.json();

      if (selectedChat === "new") {
        fetchChats().then(() => {
          setSelectedChat(data.chat_id);
        });
      }

      setMessages([...messagesWithQuery, parseMessage(data)]);

      setInput("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
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
          <ScrollArea className="h-[calc(100vh-18rem)]">
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
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 flex flex-col h-[calc(100vh-12rem)]">
          <ScrollArea ref={scrollAreaRef} className="flex-1 pr-4 mb-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  ref={
                    index === messages.length - 1
                      ? (el) =>
                          el?.scrollIntoView({
                            behavior: "instant",
                            block: "end",
                          })
                      : undefined
                  }
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
                          onDocumentReference(
                            ref.documentId,
                            ref.page,
                            ref.text
                          )
                        }
                      >
                        ...{ref.text}...
                        <span className="mt-2 flex items-center gap-1 text-muted-foreground">
                          <BookOpen className="h-4 w-4" />
                          Page {ref.page} of{" "}
                          {
                            documents.find((doc) => doc.id === ref.documentId)
                              ?.name
                          }
                        </span>
                      </div>
                    ))}
                    <div className="text-xs mt-3 opacity-70">
                      {new Date(message.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div
                  ref={(el) =>
                    el?.scrollIntoView({ behavior: "instant", block: "end" })
                  }
                  className="flex justify-start rounded-lg p-4 max-w-[80%] bg-muted"
                >
                  <div className="flex flex-col gap-2 w-full">
                    <div className="h-4 animate-pulse bg-muted-foreground/20 rounded w-[70%] mb-2" />
                    <div className="h-4 animate-pulse bg-muted-foreground/20 rounded w-[40%] mb-2" />
                    <div className="h-4 animate-pulse bg-muted-foreground/20 rounded w-[80%]" />
                    <div className="mt-2 p-2 bg-white rounded cursor-pointer text-xs shadow-sm hover:shadow-md transition-shadow">
                      <div className="h-2 animate-pulse bg-muted-foreground/20 rounded w-[50%] mb-2" />
                      <div className="h-2 animate-pulse bg-muted-foreground/20 rounded w-[75%] mb-2" />
                      <div className="h-2 animate-pulse bg-muted-foreground/20 rounded w-[30%]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                disabled={isLoading}
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[200px] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search documents..."
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandEmpty>No documents found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => setSelectedDocuments([])}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedDocuments.length === 0
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        All Documents
                      </CommandItem>
                      {documents
                        .filter((doc) =>
                          doc.name
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase())
                        )
                        .map((doc) => (
                          <CommandItem
                            key={doc.id}
                            value={doc.name}
                            onSelect={() => {
                              setSelectedDocuments((prev) => {
                                const next = prev.includes(doc.id)
                                  ? prev.filter((id) => id !== doc.id)
                                  : [...prev, doc.id];
                                return next.length === documents.length
                                  ? []
                                  : next;
                              });
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedDocuments.includes(doc.id)
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {doc.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                onClick={handleSendMessage}
                size="icon"
                disabled={isLoading || !input}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedDocuments.length === 0 ? (
                <div className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  <BookOpen className="h-3 w-3" />
                  All documents
                </div>
              ) : null}
              {selectedDocuments.map((docId) => {
                const doc = documents.find((d) => d.id === docId);
                return doc ? (
                  <div
                    key={docId}
                    className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm flex items-center gap-2"
                  >
                    <BookOpen className="h-3 w-3" />
                    {doc.name}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
