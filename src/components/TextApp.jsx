import React, { useEffect, useRef, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { BeatLoader } from 'react-spinners';

import TextAppMessageList from './TextAppMessageList';
import Constants from '../constants/Constants';

function TextApp(props) {

    // Set to true to block the user from sending another message
    const [isLoading, setIsLoading] = useState(false);

    const [messages, setMessages] = useState(() => {
        try {
            const storedData = localStorage.getItem("badger-chat-data");
            if (storedData) {
                const data = JSON.parse(storedData);
                if (data.persona === props.persona.name) {
                    return data.messages;
                }
            }
        } catch (e) {
            console.error("Failed to load history", e);
        }
        return [];
    });

    const inputRef = useRef();

    /**
     * Called when the TextApp initially mounts.
     */
    async function handleWelcome() {
        if (messages.length === 0) {
            setMessages([
                {
                    role: Constants.Roles.Assistant,
                    content: props.persona.initialMessage
                }
            ]);
        }
    }

    /**
     * Called whenever the "Send" button is pressed.
     * @param {Event} e default form event; used to prevent from reloading the page.
     */
    async function handleSend(e) {
        e?.preventDefault();
        const input = inputRef.current.value?.trim();
        
        if (input) {
            setIsLoading(true);
            
            const userMessage = { role: Constants.Roles.User, content: input };
            setMessages(prev => [...prev, userMessage]);
            inputRef.current.value = "";

            const developerMessage = {
                role: Constants.Roles.Developer,
                content: props.persona.prompt
            };

            const historyToSend = [developerMessage, ...messages, userMessage];

            setMessages(prev => [...prev, { role: Constants.Roles.Assistant, content: "" }]);

            try {
                const response = await fetch("https://cs571api.cs.wisc.edu/rest/f25/hw11/completions-stream", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CS571-ID": CS571.getBadgerId()
                    },
                    body: JSON.stringify(historyToSend)
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch response");
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let accumulatedText = "";
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    const lines = buffer.split('\n');
                    
                    buffer = lines.pop();

                    lines.forEach(line => {
                        if (line.trim()) {
                            try {
                                const json = JSON.parse(line);
                                if (json.delta) {
                                    accumulatedText += json.delta;
                                }
                            } catch (error) {
                                console.error("Error parsing JSON chunk", error);
                            }
                        }
                    });

                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastIndex = newMessages.length - 1;
                        newMessages[lastIndex] = { 
                            role: Constants.Roles.Assistant, 
                            content: accumulatedText 
                        };
                        return newMessages;
                    });
                }

            } catch (error) {
                console.error("Error in conversation:", error);
            }

            setIsLoading(false);
        }
    }

    /**
     * Adds a message to the ongoing TextAppMessageList
     * 
     * @param {string} role The role of the message; either "user", "assistant", or "developer"
     * @param {*} content The content of the message
     */
    function addMessage(role, content) {
        setMessages(o => [...o, {
            role: role,
            content: content
        }]);
    }

    useEffect(() => {
        handleWelcome();
    }, [props.persona]);

    useEffect(() => {
        const data = {
            persona: props.persona.name,
            messages: messages
        };
        localStorage.setItem("badger-chat-data", JSON.stringify(data));
    }, [messages, props.persona]);

    return (
        <div className="app">
            <TextAppMessageList messages={messages}/>
            {isLoading ? <BeatLoader color="#36d7b7"/> : <></>}
            <div className="input-area">
                <Form className="inline-form" onSubmit={handleSend}>
                    <Form.Control
                        ref={inputRef}
                        style={{ marginRight: "0.5rem", display: "flex" }}
                        placeholder="Type a message..."
                        aria-label='Type and submit to send a message.'
                    />
                    <Button type='submit' disabled={isLoading}>Send</Button>
                </Form>
            </div>
        </div>
    );
}

export default TextApp;
