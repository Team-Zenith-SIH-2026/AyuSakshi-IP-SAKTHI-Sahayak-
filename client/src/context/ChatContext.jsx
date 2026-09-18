import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { chatAPI } from '../services/api';
import { useJurisdiction } from './JurisdictionContext';
import { useLanguage } from './LanguageContext';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { jurisdiction } = useJurisdiction();
  const { language: activeLanguage } = useLanguage();
  const [conversations, setConversations] = useState([]);
  const [activeConvByJurisdiction, setActiveConvByJurisdiction] = useState({
    india: null,
    international: null,
  });

  const activeConversationId = activeConvByJurisdiction[jurisdiction] || null;

  const setActiveConversationId = (id) => {
    setActiveConvByJurisdiction((prev) => ({
      ...prev,
      [jurisdiction]: id,
    }));
  };

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  // React state updates are not synchronous, so `isLoading` alone cannot stop a
  // second submission that fires before the first render commits (a fast
  // double-click, or Enter followed immediately by a click). This ref is set
  // synchronously the instant sendMessage is entered, closing that window.
  const isSendingRef = useRef(false);
  const [currentThinking, setCurrentThinking] = useState(null);
  
  // Selected citation for Source Inspection Drawer
  const [inspectingSource, setInspectingSource] = useState(null);
  
  // Modals & Navigation Views
  const [activeModal, setActiveModal] = useState(null); // 'classify' | 'abs' | 'tkdl' | 'escalate' | 'facilitator' | 'admin' | null
  const [escalationPreFill, setEscalationPreFill] = useState(null);
  
  // Responsive sidebar states
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarPinned, setIsDesktopSidebarPinned] = useState(true);
  const [isDesktopSidebarHovered, setIsDesktopSidebarHovered] = useState(false);
  const setDesktopSidebarHovered = setIsDesktopSidebarHovered;

  const toggleMobileSidebar = () => setIsMobileSidebarOpen((prev) => !prev);
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);

  const toggleDesktopSidebar = () => setIsDesktopSidebarPinned((prev) => !prev);

  // Backward compatibility aliases
  const isSidebarOpen = isMobileSidebarOpen;
  const setIsSidebarOpen = setIsMobileSidebarOpen;
  const toggleSidebar = toggleMobileSidebar;
  const closeSidebar = () => {
    setIsMobileSidebarOpen(false);
    setIsDesktopSidebarHovered(false);
  };

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

  const startNewConversation = async (
    initialTitle = 'New AYUSH IP Inquiry',
    formulationState = {},
    conversationJurisdiction = jurisdiction
  ) => {
    try {
      const res = await chatAPI.createConversation({
        title: initialTitle,
        jurisdiction: conversationJurisdiction,
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

  // options.newConversation starts a fresh conversation for this message, seeded
  // with options.formulationState, instead of appending to the one on screen.
  // options.situation carries the situation picker's selection with the
  // sentence it composed, so the service does not have to guess from the words.
  // options.jurisdiction is for a button that switches regime and asks in one
  // click: the regime state has not re-rendered yet, so without it the question
  // would still go out under the old regime and be searched in the wrong corpus.
  const sendMessage = async (content, language = null, options = {}) => {
    if (!content.trim()) return;

    const targetLang = language || activeLanguage || 'en';
    const messageJurisdiction = options.jurisdiction || jurisdiction;

    // Closes the race that let a double-click or Enter+click send the same
    // question twice: React had not yet re-rendered with isLoading=true while
    // startNewConversation() was still in flight for a brand new conversation,
    // so the button's disabled guard did not catch the second call in time.
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    setIsLoading(true);

    let convId = options.newConversation ? null : activeConversationId;
    if (!convId) {
      const newConv = await startNewConversation(
        content.slice(0, 40),
        options.formulationState || {},
        messageJurisdiction
      );
      if (!newConv) {
        isSendingRef.current = false;
        setIsLoading(false);
        return;
      }
      convId = newConv.id;
    }

    // Optimistically append user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      conversation_id: convId,
      sender: 'user',
      content: content.trim(),
      language: targetLang,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await chatAPI.sendMessage(convId, {
        content: content.trim(),
        language: targetLang,
        jurisdiction: messageJurisdiction,
        ...(options.situation ? { situation: options.situation } : {}),
      });

      const { user_message, assistant_message } = res.data;

      // Replace temp message with verified message from server; flag as isNew for streaming animation
      const newAssistantMsg = assistant_message
        ? { ...assistant_message, isNew: true }
        : assistant_message;

      // Starting a new conversation changes activeConversationId, which reloads
      // its messages from the server while this request is still running. That
      // reload can already contain the user's message, so drop any copy of the
      // returned messages before appending them, or the question shows twice.
      const returnedIds = new Set([user_message?.id, assistant_message?.id].filter(Boolean));
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserMsg.id && !returnedIds.has(m.id));
        return [...filtered, user_message, newAssistantMsg];
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
      isSendingRef.current = false;
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
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
        closeSidebar,
        isMobileSidebarOpen,
        toggleMobileSidebar,
        closeMobileSidebar,
        isDesktopSidebarPinned,
        toggleDesktopSidebar,
        isDesktopSidebarHovered,
        setDesktopSidebarHovered,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
