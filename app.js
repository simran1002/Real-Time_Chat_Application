require("dotenv").config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { connectDB } = require("./db/connection");
const server = http.createServer(app);
const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const messages = require('./models/Message');

const app = express();
app.use(express.json());
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.post('/login', passport.authenticate('local', { session: false }), (req, res) => {
  try {
    const token = jwt.sign({ userId: req.user._id }, 'your_secret_key_here', { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/logout', (req, res) => {
  // Implement logout logic as needed (e.g., destroying session, revoking tokens)
  res.clearCookie('jwtToken');
  // For JWT, you might have to manage token blacklisting or expiration on the client side
  res.json({ message: 'Logout successful' });
});

// Middleware to protect routes with JWT authorization
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized - Token not provided' });
  }

  try {
    const decodedToken = jwt.verify(token, 'your_secret_key_here');
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: 'Unauthorized - Invalid token' });
  }
};

// Example of a protected route
app.get('/protected', requireAuth, (req, res) => {
  res.json({ message: 'You have access to this protected route!' });
});

// Socket.io logic for real-time chat and status update

const io = require('socket.io')(8000, {
    cors: {
      origin: 'http://127.0.0.1:5500',
      methods: ['GET', 'POST'],
    },
  });
  
const users={};

// io.on('connection', socket =>{
//     socket.on('new-user-joined', name =>{
//         users[socket.id]=name;
//         socket.broadcast.emit('user-joined', name);
//     });
//     socket.on('send', message =>{
//         socket.broadcast.emit('receive',{message: message, user: users[socket.id]})
//     });

//     socket.on('disconnect', () => {
//         socket.broadcast.emit('left', users[socket.id]);
//         delete users[socket.id];
//     });

// })

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
  
    // Listen for chat messages
    socket.on('chatMessage', async (data) => {
      try {
        const { content, receiverId } = data;
  
        // Assuming the sender is the authenticated user
        const senderId = socket.request.user._id;
  
        // Save the message to the database
        const newMessage = new Message({ sender: senderId, receiver: receiverId, content });
        await newMessage.save();
  
        // Broadcast the message to the receiver
        const receiverSocket = io.sockets.sockets.get(receiverId);
        if (receiverSocket) {
          receiverSocket.emit('chatMessage', { content, senderId });
        }
      } catch (error) {
        console.error(error);
      }
    });
  
    // Listen for typing status updates
    socket.on('typingStatus', (data) => {
      // Broadcast the typing status to the receiver
      const { isTyping, receiverId } = data;
      const senderId = socket.request.user._id;
  
      const receiverSocket = io.sockets.sockets.get(receiverId);
      if (receiverSocket) {
        receiverSocket.emit('typingStatus', { isTyping, senderId });
      }
    });
  
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
  
  app.use(express.static('public'));

  // Example route for serving the HTML file with the chat interface
  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
  });
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal server error' });
  });

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}`);
});