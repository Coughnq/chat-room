document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://mtuoykwyjtxyusfdznta.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dW95a3d5anR4eXVzZmR6bnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjUyMzkzNTMsImV4cCI6MjA0MDgxNTM1M30.cPbXqCznx21mqWPAtRE1uyl5eFPKD5CvtvrhCJQ1B2g';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messagesContainer = document.getElementById('messages-container');
    const messagesDiv = document.getElementById('messages');
    const changeNameInput = document.getElementById('change-name');
    const themeToggle = document.getElementById('theme-toggle');

    let anonymousId = localStorage.getItem('anonymousId') || `User-${Math.random().toString(36).substr(2, 6)}`;
    let lastMessageTime = 0;
    const MESSAGE_COOLDOWN = 2000; // 2 seconds cooldown

    changeNameInput.value = anonymousId;

    changeNameInput.addEventListener('change', () => {
        anonymousId = changeNameInput.value.trim() || `User-${Math.random().toString(36).substr(2, 6)}`;
        changeNameInput.value = anonymousId;
        localStorage.setItem('anonymousId', anonymousId);
    });

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function sendMessage() {
        const now = Date.now();
        if (now - lastMessageTime < MESSAGE_COOLDOWN) {
            console.log(`Please wait ${(MESSAGE_COOLDOWN - (now - lastMessageTime)) / 1000} seconds before sending another message.`);
            return;
        }

        const messageText = messageInput.value.trim();
        if (!messageText) return;

        try {
            const messageData = {
                content: messageText,
                user_name: anonymousId,
                topic: 'General',
            };

            const { data, error } = await supabaseClient
                .from('messages')
                .insert([messageData])
                .select();

            if (error) throw error;

            messageInput.value = '';
            lastMessageTime = Date.now();
            updateSendButtonState();

            // We'll let the real-time subscription handle adding the message to the UI
        } catch (error) {
            console.error('Error sending message:', error.message);
            if (error.details) console.error('Error details:', error.details);
        }
    }

    function updateSendButtonState() {
        const sendButton = messageForm.querySelector('button[type="submit"]');
        const now = Date.now();
        if (now - lastMessageTime < MESSAGE_COOLDOWN) {
            sendButton.disabled = true;
            setTimeout(() => {
                sendButton.disabled = false;
            }, MESSAGE_COOLDOWN - (now - lastMessageTime));
        } else {
            sendButton.disabled = false;
        }
    }

    function createMessageElement(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        const isOwnMessage = message.user_name === anonymousId;
        if (isOwnMessage) {
            messageElement.classList.add('own-message');
        }
        const timestamp = new Date(message.created_at);
        const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageElement.innerHTML = `
            <span class="time">[${timeString}]</span>
            ${isOwnMessage ? '' : `<span class="user">${message.user_name}:</span>`}
            <span class="content">${message.content}</span>
        `;
        return messageElement;
    }

    async function loadMessages() {
        try {
            const { data, error } = await supabaseClient
                .from('messages')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            messagesDiv.innerHTML = '';
            data.reverse().forEach(message => {
                messagesDiv.appendChild(createMessageElement(message));
            });
            scrollToBottom();
        } catch (error) {
            console.error('Error loading messages:', error.message);
            if (error.details) console.error('Error details:', error.details);
        }
    }

    function subscribeToMessages() {
        supabaseClient
            .channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                const messageElement = createMessageElement(payload.new);
                messagesDiv.appendChild(messageElement);
                scrollToBottom();
            })
            .subscribe();
    }

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        if (html.getAttribute('data-theme') === 'light') {
            html.setAttribute('data-theme', 'dark');
            themeToggle.textContent = '☀️';
        } else {
            html.setAttribute('data-theme', 'light');
            themeToggle.textContent = '🌙';
        }
    });

    loadMessages();
    subscribeToMessages();
    updateSendButtonState();
});
