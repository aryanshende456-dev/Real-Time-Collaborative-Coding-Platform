import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5001");

const languages = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
];

function App() {
  // =========================================
  // ROOM
  // =========================================

  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");

  // =========================================
  // USER
  // =========================================

  const [username, setUsername] = useState("");

  // =========================================
  // USERS ONLINE
  // =========================================

  const [userCount, setUserCount] = useState(0);

  // =========================================
  // LANGUAGE
  // =========================================

  const [language, setLanguage] = useState("javascript");

  // =========================================
  // CODE
  // =========================================

  const [code, setCode] = useState(
`function hello() {
  console.log("Hello World");
}

hello();`
  );

  // =========================================
  // OUTPUT
  // =========================================

  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  // =========================================
  // CHAT
  // =========================================

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  // =========================================
  // SOCKET EVENTS
  // =========================================

  useEffect(() => {

    // -----------------------------------------
    // ROOM STATE
    // -----------------------------------------

    const handleRoomState = (data) => {
      setCode(data.code);
      setLanguage(data.language);
    };

    // -----------------------------------------
    // CODE UPDATE
    // -----------------------------------------

    const handleCodeUpdate = (data) => {
      setCode(data.code);
    };

    // -----------------------------------------
    // LANGUAGE UPDATE
    // -----------------------------------------

    const handleLanguageUpdate = (data) => {
      setLanguage(data.language);
      setCode(data.code);
    };

    // -----------------------------------------
    // USER COUNT
    // -----------------------------------------

    const handleUserCount = (data) => {
      setUserCount(data.count);
    };

    // -----------------------------------------
    // CHAT HISTORY
    // -----------------------------------------

    const handleChatHistory = (history) => {
      setMessages(history);
    };

    // -----------------------------------------
    // NEW CHAT MESSAGE
    // -----------------------------------------

    const handleReceiveMessage = (message) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        message,
      ]);
    };

    // -----------------------------------------
    // CODE OUTPUT
    // -----------------------------------------

    const handleCodeOutput = (data) => {
      setOutput(data.output);
      setIsRunning(false);
    };

    // =========================================
    // REGISTER SOCKET EVENTS
    // =========================================

    socket.on(
      "room-state",
      handleRoomState
    );

    socket.on(
      "code-update",
      handleCodeUpdate
    );

    socket.on(
      "language-update",
      handleLanguageUpdate
    );

    socket.on(
      "user-count",
      handleUserCount
    );

    socket.on(
      "chat-history",
      handleChatHistory
    );

    socket.on(
      "receive-message",
      handleReceiveMessage
    );

    socket.on(
      "code-output",
      handleCodeOutput
    );

    // =========================================
    // CLEANUP
    // =========================================

    return () => {

      socket.off(
        "room-state",
        handleRoomState
      );

      socket.off(
        "code-update",
        handleCodeUpdate
      );

      socket.off(
        "language-update",
        handleLanguageUpdate
      );

      socket.off(
        "user-count",
        handleUserCount
      );

      socket.off(
        "chat-history",
        handleChatHistory
      );

      socket.off(
        "receive-message",
        handleReceiveMessage
      );

      socket.off(
        "code-output",
        handleCodeOutput
      );
    };

  }, []);

  // =========================================
  // JOIN ROOM
  // =========================================

  const joinRoom = () => {

    if (
      !roomId.trim() ||
      !username.trim()
    ) {
      return;
    }

    socket.emit(
      "join-room",
      {
        roomId: roomId.trim(),
        username: username.trim(),
      }
    );

    setJoinedRoom(
      roomId.trim()
    );

    setMessages([]);
    setOutput("");
  };

  // =========================================
  // CODE CHANGE
  // =========================================

  const handleCodeChange = (value) => {

    const newCode = value || "";

    // Update local editor
    setCode(newCode);

    // Send to server
    if (joinedRoom) {

      socket.emit(
        "code-change",
        {
          roomId: joinedRoom,
          code: newCode,
        }
      );
    }
  };

  // =========================================
  // LANGUAGE CHANGE
  // =========================================

  const handleLanguageChange = (e) => {

    const newLanguage =
      e.target.value;

    setLanguage(newLanguage);
    setOutput("");

    if (joinedRoom) {

      socket.emit(
        "language-change",
        {
          roomId: joinedRoom,
          language: newLanguage,
        }
      );
    }
  };

  // =========================================
  // RUN CODE
  // =========================================

  const runCode = () => {

    if (!joinedRoom) {
      return;
    }

    setIsRunning(true);
    setOutput("Running...");

    socket.emit(
      "run-code",
      {
        roomId: joinedRoom,
        code,
        language,
      }
    );
  };

  // =========================================
  // SEND MESSAGE
  // =========================================

  const sendMessage = () => {

    if (
      !messageInput.trim() ||
      !joinedRoom
    ) {
      return;
    }

    socket.emit(
      "send-message",
      {
        roomId: joinedRoom,
        message: messageInput.trim(),
      }
    );

    setMessageInput("");
  };

  // =========================================
  // MESSAGE ENTER KEY
  // =========================================

  const handleMessageKeyDown = (e) => {

    if (e.key === "Enter") {
      sendMessage();
    }
  };

  // =========================================
  // UI
  // =========================================

  return (
    <div className="min-h-screen bg-gray-900 text-white">

      {/* =====================================
          HEADER
      ====================================== */}

      <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">

        <h1 className="text-xl font-bold">
          Collaborative Coding
        </h1>

        <div className="flex items-center gap-3">

          {/* USERNAME */}

          <input
            type="text"
            placeholder="Your Name"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value)
            }
            className="px-3 py-2 bg-gray-700 rounded-lg outline-none"
          />

          {/* ROOM ID */}

          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) =>
              setRoomId(e.target.value)
            }
            onKeyDown={(e) => {

              if (e.key === "Enter") {
                joinRoom();
              }

            }}
            className="px-3 py-2 bg-gray-700 rounded-lg outline-none"
          />

          {/* JOIN */}

          <button
            onClick={joinRoom}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Join Room
          </button>

        </div>

      </header>

      {/* =====================================
          MAIN
      ====================================== */}

      <main className="p-4">

        {joinedRoom ? (

          <div>

            {/* =================================
                ROOM INFORMATION
            ================================== */}

            <div className="mb-3 flex justify-between items-center">

              <div>

                <span className="text-gray-400">
                  Room:
                </span>

                <span className="ml-2 font-semibold">
                  {joinedRoom}
                </span>

              </div>

              <div className="flex items-center gap-4">

                <div className="text-green-400 text-sm">
                  ● Connected
                </div>

                <div className="bg-gray-800 px-3 py-1 rounded-lg text-sm">

                  👥 {userCount}{" "}

                  {userCount === 1
                    ? "User"
                    : "Users"}

                </div>

              </div>

            </div>

            {/* =================================
                LANGUAGE BAR
            ================================== */}

            <div className="bg-gray-800 border border-gray-700 px-4 py-3 flex items-center justify-between rounded-t-lg">

              <div className="flex items-center gap-3">

                <label className="text-gray-400">
                  Language:
                </label>

                <select
                  value={language}
                  onChange={
                    handleLanguageChange
                  }
                  className="bg-gray-700 px-3 py-2 rounded-lg outline-none"
                >

                  {languages.map((item) => (

                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>

                  ))}

                </select>

              </div>

              <div className="flex items-center gap-3">

                <span className="text-gray-400 text-sm">
                  {language.toUpperCase()}
                </span>

                <button
                  onClick={runCode}
                  disabled={isRunning}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold"
                >
                  {isRunning
                    ? "Running..."
                    : "▶ Run"}
                </button>

              </div>

            </div>

            {/* =================================
                EDITOR + CHAT
            ================================== */}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

              {/* =================================
                  EDITOR + OUTPUT
              ================================== */}

              <div className="flex flex-col gap-3">

                {/* EDITOR */}

                <div className="border border-gray-700 rounded-lg overflow-hidden">

                  <Editor
                    height="55vh"
                    language={language}
                    value={code}
                    onChange={handleCodeChange}
                    theme="vs-dark"
                    options={{
                      minimap: {
                        enabled: false,
                      },

                      fontSize: 16,

                      automaticLayout: true,
                    }}
                  />

                </div>

                {/* OUTPUT */}

                <div className="bg-gray-800 border border-gray-700 rounded-lg">

                  <div className="px-4 py-3 border-b border-gray-700 flex justify-between">

                    <h2 className="font-semibold">
                      Output
                    </h2>

                    <button
                      onClick={() =>
                        setOutput("")
                      }
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Clear
                    </button>

                  </div>

                  <pre className="p-4 text-sm text-green-400 min-h-[120px] max-h-[200px] overflow-auto whitespace-pre-wrap">
                    {output ||
                      "Run your code to see the output here."}
                  </pre>

                </div>

              </div>

              {/* =================================
                  CHAT
              ================================== */}

              <div className="bg-gray-800 border border-gray-700 rounded-lg flex flex-col h-[70vh]">

                {/* CHAT HEADER */}

                <div className="px-4 py-3 border-b border-gray-700">

                  <h2 className="font-semibold">
                    💬 Room Chat
                  </h2>

                  <p className="text-xs text-gray-400 mt-1">

                    {userCount}{" "}

                    {userCount === 1
                      ? "user"
                      : "users"}{" "}
                    online

                  </p>

                </div>

                {/* MESSAGES */}

                <div className="flex-1 overflow-y-auto p-4 space-y-3">

                  {messages.length === 0 ? (

                    <p className="text-gray-500 text-sm text-center mt-5">
                      No messages yet.
                    </p>

                  ) : (

                    messages.map((item) => (

                      <div
                        key={
                          item.id ||
                          item._id
                        }
                        className="bg-gray-700 rounded-lg p-3"
                      >

                        <p className="text-xs text-blue-400 mb-1">

                          {item.sender === username
                            ? "You"
                            : item.sender}

                        </p>

                        <p className="text-sm break-words">
                          {item.message}
                        </p>

                      </div>

                    ))

                  )}

                </div>

                {/* MESSAGE INPUT */}

                <div className="p-3 border-t border-gray-700">

                  <div className="flex gap-2">

                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) =>
                        setMessageInput(
                          e.target.value
                        )
                      }
                      onKeyDown={
                        handleMessageKeyDown
                      }
                      className="flex-1 bg-gray-700 px-3 py-2 rounded-lg outline-none text-sm"
                    />

                    <button
                      onClick={sendMessage}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                    >
                      Send
                    </button>

                  </div>

                </div>

              </div>

            </div>

          </div>

        ) : (

          /* ===================================
             JOIN SCREEN
          ==================================== */

          <div className="h-[80vh] flex items-center justify-center">

            <div className="text-center">

              <h2 className="text-3xl font-bold mb-3">
                Join a Coding Room
              </h2>

              <p className="text-gray-400">
                Enter your name and a Room ID above to start coding.
              </p>

            </div>

          </div>

        )}

      </main>

    </div>
  );
}

export default App;