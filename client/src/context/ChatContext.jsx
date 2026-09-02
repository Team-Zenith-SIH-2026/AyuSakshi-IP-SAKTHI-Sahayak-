import React, { createContext, useContext, useState, useEffect } from 'react';
import { chatAPI } from '../services/api';
import { useJurisdiction } from './JurisdictionContext';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { jurisdiction } = useJurisdiction();
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentThinking, setCurrentThinking] = useState(null);
  
  // Selected citation for Source Inspection Drawer
  const [inspectingSource, setInspectingSource] = useState(null);
  
  // Modals & Navigation Views
  const [activeModal, setActiveModal] = useState(null); // 'classify' | 'abs' | 'tkdl' | 'escalate' | 'facilitator' | 'admin' | null
  const [escalationPreFill, setEscalationPreFill] = useState(null);

  // Load conversations on mount or jurisdiction change
  useEffect(() => {
    fetchConversations();
  }, [jurisdiction]);

  // Load messages when activeConversationId changes
  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  const fetchConversations = async () => {
    try {
      const res = await chatAPI.listConversations(jurisdiction);
      if (res.data?.conversations) {
        setConversations(res.data.conversations);
      }
    } catch (err) {
      console.warn('[ChatContext] Failed to fetch conversations:', err.message);
    }
  };

  const fetchMessages = async (convId) => {
    setIsLoading(true);
    try {
      const res = await chatAPI.getMessages(convId);
      if (res.data?.messages) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.warn('[ChatContext] Failed to fetch messages:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = async (initialTitle = 'New AYUSH IP Inquiry', formulationState = {}) => {
    try {
      const res = await chatAPI.createConversation({
        title: initialTitle,
        jurisdiction,
        formulation_state: formulationState,
      });
      const newConv = res.data.conversation;
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      return newConv;
    } catch (err) {
      console.error('[ChatContext] Create conversation failed:', err.message);
      return null;
    }
  };

  const sendMessage = async (content, language = 'en') => {
    if (!content.trim()) return;

    let convId = activeConversationId;
    if (!convId) {
      const newConv = await startNewConversation(content.slice(0, 40));
      if (!newConv) return;
      convId = newConv.id;
    }

    // Optimistically append user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      conversation_id: convId,
      sender: 'user',
      content: content.trim(),
      language,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await chatAPI.sendMessage(convId, {
        content: content.trim(),
        language,
        jurisdiction,
      });

      const { user_message, assistant_message } = res.data;

      // Replace temp message with verified message from server
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
        return [...filtered, user_message, assistant_message];
      });

      // Update conversations list title if changed
      fetchConversations();
    } catch (err) {
      console.error('[ChatContext] Send message failed:', err.message);
      const errorAssistantMsg = {
        id: `err-${Date.now()}`,
        conversation_id: convId,
        sender: 'assistant',
        content: 'I could not connect to the regulatory intelligence engine. Please check your network or try again.',
        confidence_level: 'abstained',
        confidence_score: 0.0,
        citations: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorAssistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async (convId) => {
    try {
      await chatAPI.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('[ChatContext] Delete conversation failed:', err.message);
    }
  };

  const openEscalation = (msg) => {
    setEscalationPreFill({
      conversation_id: activeConversationId,
      question: messages.find((m) => m.sender === 'user')?.content || 'Inquiry regarding Ayurvedic IP classification',
      formulation_summary: msg?.classification?.reasoning || null,
      retrieved_evidence: msg?.citations || [],
      system_confidence: msg?.confidence_score || 0.0,
      reason: 'Low confidence / Complex multi-regime legal interpretation required.',
    });
    setActiveModal('escalate');
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        setActiveConversationId,
        messages,
        isLoading,
        currentThinking,
        inspectingSource,
        setInspectingSource,
        activeModal,
        setActiveModal,
        escalationPreFill,
        openEscalation,
        startNewConversation,
        sendMessage,
        deleteConversation,
        refreshConversations: fetchConversations,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
