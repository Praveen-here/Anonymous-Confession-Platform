require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// server.js
app.use(cors({
    origin: 'http://localhost:3000', // Replace with your frontend URL
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 3600000 // 1 hour
    }
  }));

  // Add after session middleware
app.use((req, res, next) => {
    if (req.session && req.session.isAdmin) {
      req.session.touch();
      req.session.save();
    }
    next();
  });
  
// MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB Atlas connection error:', err));

// Configure Multer for file uploads (moved up for better organization)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `banner-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Auth middleware
const authenticateAdmin = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
};

// Schemas
const postSchema = new mongoose.Schema({
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    comments: [{
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }],
    likes: { type: Number, default: 0 }
});

const Post = mongoose.model('Post', postSchema);

const bannerSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const Banner = mongoose.model('Banner', bannerSchema);

// Routes
// Add to server.js routes
app.get('/api/clear-cache', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.send('Cache cleared');
  });

// Posts routes
app.post('/api/posts', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ message: 'Post content cannot be empty!' });
        const newPost = new Post({ content });
        await newPost.save();
        res.status(201).json({ message: 'Post created successfully!' });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Admin routes
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.get('/api/admin/check', authenticateAdmin, (req, res) => {
    res.json({ authenticated: true });
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Banner routes (updated with authentication)
app.get('/api/banner', async (req, res) => {
    try {
        const banner = await Banner.findOne().sort({ updatedAt: -1 });
        res.json(banner || { imageUrl: '' });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching banner' });
    }
});

app.post('/api/upload', 
    authenticateAdmin,
    upload.single('banner'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const newBanner = new Banner({
                imageUrl: `/uploads/${req.file.filename}`
            });

            await newBanner.save();
            res.json({ 
                message: 'Banner updated successfully',
                imageUrl: newBanner.imageUrl
            });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ message: 'Error uploading banner' });
        }
    }
);

// Other post-related routes
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/posts/:postId/like', async (req, res) => {
    try {
        const { postId } = req.params;
        const post = await Post.findByIdAndUpdate(
            postId,
            { $inc: { likes: 1 } },
            { new: true }
        );
        if (!post) return res.status(404).json({ message: 'Post not found' });
        res.status(200).json({ likes: post.likes });
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/posts/:postId/comments', async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        
        if (!content) {
            return res.status(400).json({ message: 'Comment cannot be empty!' });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        post.comments.push({ content });
        await post.save();

        res.status(201).json({ message: 'Comment added successfully!' });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/posts/:postId/comments', async (req, res) => {
    try {
        const { postId } = req.params;
        const post = await Post.findById(postId);
        
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        res.status(200).json(post.comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});