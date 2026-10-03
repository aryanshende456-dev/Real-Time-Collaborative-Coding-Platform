require("dotenv").config();

const connectDB = require("./config/db");

const Room = require("./models/room");
const Message = require("./models/message");

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// =========================================
// SOCKET.IO
// =========================================

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// =========================================
// TEMPORARY ROOM USER STORAGE
// =========================================

const rooms = {};

// =========================================
// DEFAULT CODE
// =========================================

const defaultCode = {
  javascript: `function hello() {
  console.log("Hello World");
}

hello();`,

  python: `def hello():
    print("Hello World")

hello()`,

  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}`,

  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello World";
    return 0;
}`,

  html: `<h1>Hello World</h1>`,

  css: `body {
    background: black;
    color: white;
}`,

  json: `{
  "message": "Hello World"
}`,
};

// =========================================
// TEST ROUTE
// =========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "Collaborative Coding Backend is running",
  });
});

// =========================================
// SOCKET.IO CONNECTION
// =========================================

io.on("connection", (socket) => {

  console.log(
    "User connected:",
    socket.id
  );

  // =======================================
  // JOIN ROOM
  // =======================================

  socket.on(
    "join-room",
    async ({ roomId, username }) => {

      try {

        // -----------------------------------
        // VALIDATION
        // -----------------------------------

        if (
          !roomId ||
          !username
        ) {

          socket.emit(
            "room-error",
            {
              message:
                "Room ID and username are required",
            }
          );

          return;
        }

        // -----------------------------------
        // FIND ROOM
        // -----------------------------------

        let room = await Room.findOne({
          roomId,
        });

        // -----------------------------------
        // CREATE ROOM
        // -----------------------------------

        if (!room) {

          room = await Room.create({
            roomId,
            code:
              defaultCode.javascript,
            language: "javascript",
          });

          console.log(
            `New room created in MongoDB: ${roomId}`
          );

        } else {

          console.log(
            `Existing room loaded from MongoDB: ${roomId}`
          );

        }

        // -----------------------------------
        // CREATE MEMORY STATE
        // -----------------------------------

        if (!rooms[roomId]) {

          rooms[roomId] = {
            code: room.code,
            language: room.language,
            users: new Set(),
          };

        }

        // -----------------------------------
        // JOIN SOCKET.IO ROOM
        // -----------------------------------

        socket.join(roomId);

        // -----------------------------------
        // ADD USER
        // -----------------------------------

        rooms[roomId].users.add(
          socket.id
        );

        // -----------------------------------
        // SAVE SOCKET INFORMATION
        // -----------------------------------

        socket.roomId = roomId;
        socket.username = username;

        console.log(
          `${username} (${socket.id}) joined room ${roomId}`
        );

        // -----------------------------------
        // SEND ROOM STATE
        // -----------------------------------

        socket.emit(
          "room-state",
          {
            code: room.code,
            language: room.language,
          }
        );

        // -----------------------------------
        // LOAD CHAT HISTORY
        // -----------------------------------

        const chatHistory =
          await Message.find({
            roomId,
          })
          .sort({
            createdAt: 1,
          })
          .limit(50);

        socket.emit(
          "chat-history",
          chatHistory
        );

        // -----------------------------------
        // UPDATE USER COUNT
        // -----------------------------------

        io.to(roomId).emit(
          "user-count",
          {
            count:
              rooms[roomId].users.size,
          }
        );

        // -----------------------------------
        // NOTIFY OTHER USERS
        // -----------------------------------

        socket
          .to(roomId)
          .emit(
            "user-joined",
            {
              message:
                `${username} joined the room`,
            }
          );

      } catch (error) {

        console.error(
          "Error joining room:",
          error.message
        );

        socket.emit(
          "room-error",
          {
            message:
              "Could not join room",
          }
        );

      }
    }
  );

  // =======================================
  // CODE CHANGE
  // =======================================

  socket.on(
    "code-change",
    async ({ roomId, code }) => {

      if (!rooms[roomId]) {
        return;
      }

      // Update memory
      rooms[roomId].code = code;

      // Send to other users
      socket
        .to(roomId)
        .emit(
          "code-update",
          {
            code,
          }
        );

      // Save to MongoDB
      try {

        await Room.findOneAndUpdate(
          { roomId },
          { code },
          { new: true }
        );

      } catch (error) {

        console.error(
          "Error saving code:",
          error.message
        );

      }
    }
  );

  // =======================================
  // LANGUAGE CHANGE
  // =======================================

  socket.on(
    "language-change",
    async ({
      roomId,
      language,
    }) => {

      if (!rooms[roomId]) {
        return;
      }

      const newCode =
        defaultCode[language] || "";

      // Update memory
      rooms[roomId].language =
        language;

      rooms[roomId].code =
        newCode;

      // Save to MongoDB
      try {

        await Room.findOneAndUpdate(
          { roomId },
          {
            language,
            code: newCode,
          },
          {
            new: true,
          }
        );

      } catch (error) {

        console.error(
          "Error saving language:",
          error.message
        );

      }

      // Send to everyone
      io.to(roomId).emit(
        "language-update",
        {
          language,
          code: newCode,
        }
      );
    }
  );

  // =======================================
  // SEND CHAT MESSAGE
  // =======================================

  socket.on(
    "send-message",
    async ({
      roomId,
      message,
    }) => {

      if (!rooms[roomId]) {
        return;
      }

      const trimmedMessage =
        message.trim();

      if (!trimmedMessage) {
        return;
      }

      try {

        // Save message
        const savedMessage =
          await Message.create({
            roomId,

            sender:
              socket.username,

            message:
              trimmedMessage,
          });

        // Send message to everyone
        io.to(roomId).emit(
          "receive-message",
          {
            id:
              savedMessage._id,

            sender:
              savedMessage.sender,

            message:
              savedMessage.message,

            createdAt:
              savedMessage.createdAt,
          }
        );

      } catch (error) {

        console.error(
          "Error saving message:",
          error.message
        );

      }
    }
  );

  // =======================================
  // RUN CODE
  // =======================================

  socket.on(
    "run-code",
    ({ roomId, code, language }) => {

      if (!rooms[roomId]) {
        return;
      }

      // -----------------------------------
      // JAVASCRIPT ONLY FOR NOW
      // -----------------------------------

      if (language !== "javascript") {

        socket.emit(
          "code-output",
          {
            output:
              "Currently only JavaScript execution is supported.",
          }
        );

        return;
      }

      try {

        let output = "";

        // Save original console.log
        const originalLog =
          console.log;

        // Capture console.log()
        console.log = (...args) => {

          output +=
            args.join(" ") +
            "\n";

        };

        // Execute JavaScript
        eval(code);

        // Restore console.log
        console.log =
          originalLog;

        socket.emit(
          "code-output",
          {
            output:
              output ||
              "Code executed successfully.",
          }
        );

      } catch (error) {

        // Restore console.log
        console.log =
          console.log;

        socket.emit(
          "code-output",
          {
            output:
              `Error: ${error.message}`,
          }
        );
      }
    }
  );

  // =======================================
  // DISCONNECT
  // =======================================

  socket.on(
    "disconnect",
    () => {

      console.log(
        "User disconnected:",
        socket.id
      );

      const roomId =
        socket.roomId;

      if (
        !roomId ||
        !rooms[roomId]
      ) {
        return;
      }

      // Remove user
      rooms[roomId].users.delete(
        socket.id
      );

      // Update user count
      io.to(roomId).emit(
        "user-count",
        {
          count:
            rooms[roomId]
              .users
              .size,
        }
      );

      // Delete memory state
      // when nobody is connected
      if (
        rooms[roomId]
          .users
          .size === 0
      ) {

        delete rooms[roomId];

        console.log(
          `Room ${roomId} removed from memory`
        );
      }
    }
  );
});

// =========================================
// START SERVER
// =========================================

const PORT = 5001;

connectDB();

server.listen(
  PORT,
  () => {

    console.log(
      `Server running on http://localhost:${PORT}`
    );

  }
);