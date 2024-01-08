require("dotenv").config();

const express = require('express');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { connectDB } = require("./db/connection");
const passport = require('passport');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const messages = require('./models/Message');

const app = express();
app.use(express.json());

app.use(session({ secret: process.env.SECRET_KEY, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static('public'));
const path = require('path');

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;


    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({ username, password: hashedPassword });

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Login unsuccessful' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      const err = new Error('Enter the correct password');
      err.status = 401;
      throw err;
    }

    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: '1h' });

    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || 'Internal server error' });
  }
});


app.post('/logout', (req, res) => {
  res.clearCookie('jwtToken');
  res.json({ message: 'Logout successful' });
});

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


const server = http.createServer(app);
const io = new socketIo.Server(server, {
  cors: {
    origin: 'http://127.0.0.1:5500',
    methods: ['GET', 'POST'],
  },
});
const users={};


io.on('connection', socket =>{
  socket.on('new-user-joined', name =>{
      users[socket.id]=name;
      socket.broadcast.emit('user-joined', name);
  });
  socket.on('send', message =>{
      socket.broadcast.emit('receive',{message: message, user: users[socket.id]})
  });

  socket.on('disconnect', () => {
      socket.broadcast.emit('left', users[socket.id]);
      delete users[socket.id];
  });

})


// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
  
    // Listen for chat messages
    socket.on('chatMessage', async (data) => {
      try {
        const { content, receiverId } = data;
  
        const senderId = socket.request.user._id;
  
        const newMessage = new messages({ sender: senderId, receiver: receiverId, content });
        await newMessage.save();
  
        const receiverSocket = io.sockets.sockets.get(receiverId);
        if (receiverSocket) {
          receiverSocket.emit('chatMessage', { content, senderId });
        }
      } catch (error) {
        console.error(error);
      }
    });
  
    socket.on('typingStatus', (data) => {
      const { isTyping, receiverId } = data;
      const senderId = socket.request.user._id;
  
      const receiverSocket = io.sockets.sockets.get(receiverId);
      if (receiverSocket) {
        receiverSocket.emit('typingStatus', { isTyping, senderId });
      }
    });
  
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
  
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal server error' });
  });

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});