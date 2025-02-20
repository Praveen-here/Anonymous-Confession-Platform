require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB Atlas connection error:', err));

// Updated Post Schema with likes
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

// Routes
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

app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// New Like Endpoint
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

// Add a comment to a post
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

// Fetch comments for a post
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

// Configure Multer for file uploads
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

// Add Banner Schema
const bannerSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const Banner = mongoose.model('Banner', bannerSchema);

// Add these routes before app.listen()
// Get current banner
app.get('/api/banner', async (req, res) => {
    try {
        const banner = await Banner.findOne().sort({ updatedAt: -1 });
        res.json(banner || { imageUrl: '' });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching banner' });
    }
});

// Upload banner
app.post('/api/upload', upload.single('banner'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const newBanner = new Banner({
            imageUrl: `/uploads/${req.file.filename}`
        });

        await newBanner.save();
        res.json({ message: 'Banner updated successfully', imageUrl: newBanner.imageUrl });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Error uploading banner' });
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});