require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 5000;

const { moderateText } = require('./utils/moderation'); // Make sure this file exists

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware Setup
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://res.cloudinary.com',
        'https://anonymous-posting-site.onrender.com' // Add your actual deployed domain here
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('Connected to MongoDB Atlas');
    initializeAdmin();
})
.catch(err => console.error('MongoDB Atlas connection error:', err));

// Schemas
const postSchema = new mongoose.Schema({
    content: { type: String, required: false },
    imageUrl: { type: String, required: false },
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

const backgroundSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    public_id: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const Background = mongoose.model('Background', backgroundSchema);

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const Admin = mongoose.model('Admin', adminSchema);

// Add to server.js after other schemas
const discussionHallSchema = new mongoose.Schema({
    topic: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    status: { 
        type: String, 
        enum: ['active', 'expired'], 
        default: 'active',
        index: true  // Add index for better performance
    }
});

discussionHallSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const chatMessageSchema = new mongoose.Schema({
    hallId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiscussionHall' },
    userNumber: { type: String, required: true }, // Changed from Number to String
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const DiscussionHall = mongoose.model('DiscussionHall', discussionHallSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

// Initialize admin account
async function initializeAdmin() {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const admin = new Admin({
            username: 'admin',
            password: hashedPassword
        });
        await admin.save();
        console.log('Default admin created');
    }
}

// API Routes
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin) return res.status(401).json({ success: false });
        
        const valid = await bcrypt.compare(password, admin.password);
        res.json({ success: valid });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/upload/post', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const result = await cloudinary.uploader.upload(dataURI, {
            folder: "posts",
            resource_type: "auto"
        });

        res.json({ imageUrl: result.secure_url });
    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ message: 'Image upload failed' });
    }
});

app.post('/api/upload', upload.single('banner'), async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        
        if (!admin || !(await bcrypt.compare(password, admin.password))) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const result = await cloudinary.uploader.upload(dataURI, {
            folder: "banners",
            resource_type: "auto"
        });

        const newBanner = new Banner({ imageUrl: result.secure_url });
        await newBanner.save();
        
        // Send explicit success status
        return res.status(200).json({ 
            success: true,
            message: 'Banner updated successfully',
            imageUrl: newBanner.imageUrl
        });
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Upload failed' 
        });
    }
});

// Update the background upload endpoint
app.post('/api/upload/background', upload.single('background'), async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        
        if (!admin || !(await bcrypt.compare(password, admin.password))) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const result = await cloudinary.uploader.upload(dataURI, {
            folder: "backgrounds",
            resource_type: "auto"
        });

        const ratio = result.width / result.height;
        if (Math.abs(ratio - (9/16)) > 0.01) {
            await cloudinary.uploader.destroy(result.public_id);
            return res.status(400).json({ message: 'Image must be 9:16 aspect ratio' });
        }

        // Create new entry without deleting old ones (like banners)
        const newBackground = new Background({
            imageUrl: result.secure_url,
            public_id: result.public_id
        });
        await newBackground.save();
        
        res.json({ 
            message: 'Background updated successfully',
            imageUrl: newBackground.imageUrl
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Upload failed' });
    }
});

// Static files
app.use(express.static('public'));

// Banner route
// Update both image endpoints
app.get('/api/banner', async (req, res) => {
    try {
        const banner = await Banner.findOne().sort({ updatedAt: -1 });
        res.set('Cache-Control', 'no-store, max-age=0');
        res.json(banner || { imageUrl: '' });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching banner' });
    }
});

// Update background fetch endpoint to match banner behavior
app.get('/api/background', async (req, res) => {
    try {
        const background = await Background.findOne().sort({ updatedAt: -1 });
        res.set('Cache-Control', 'no-store, max-age=0');
        res.json(background || { imageUrl: '' });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching background' });
    }
});

// Update post creation endpoint
app.post('/api/posts', async (req, res) => {
    try {
        const { content, imageUrl } = req.body;

        if (!content && !imageUrl) {
            return res.status(400).json({ message: 'Post requires text or image' });
        }

        if (content && !(await moderateText(content))) {
            return res.status(400).json({ message: 'Inappropriate content detected' });
        }

        const newPost = new Post({ content, imageUrl });
        await newPost.save();

        res.status(201).json({ message: 'Post created successfully' });
    } catch (error) {
        console.error('Post creation error:', error);
        res.status(500).json({ message: 'Error creating post' });
    }
});


app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/posts/:postId/like', async (req, res) => {
    try {
        const { liked } = req.body;
        const increment = liked ? 1 : -1;

        const post = await Post.findByIdAndUpdate(
            req.params.postId,
            { $inc: { likes: increment } },
            { new: true }
        );
        
        if (!post) return res.status(404).json({ message: 'Post not found' });
        res.json({ likes: post.likes });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/posts/:postId/comments', async (req, res) => {
    try {
        const { content } = req.body;

        if (!content || !(await moderateText(content))) {
            return res.status(400).json({ message: 'Inappropriate comment detected' });
        }

        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        post.comments.push({ content });
        await post.save();

        res.status(201).json({ message: 'Comment added' });
    } catch (error) {
        console.error('Comment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.get('/api/posts/:postId/comments', async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: 'Post not found' });
        res.json(post.comments);
    } catch (error) {
        console.error('Comments error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add to server.js before listening
// Get active discussion hall
// Update active halls endpoint
// Change active halls endpoint to return multiple halls
app.get('/api/discussion-halls/active', async (req, res) => {
    try {
        const halls = await DiscussionHall.find({ 
            status: 'active',
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 });
        
        res.json(halls);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create discussion hall (admin only)
app.post('/api/discussion-halls', async (req, res) => {
    try {
        const { username, password, topic } = req.body;
        const admin = await Admin.findOne({ username });
        
        if (!admin || !(await bcrypt.compare(password, admin.password))) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours
        const newHall = new DiscussionHall({ 
            topic,
            createdBy: admin._id,
            expiresAt,
            status: 'active'
        });

        await newHall.save();
        res.status(201).json(newHall);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get chat messages
app.get('/api/chat-messages/:hallId', async (req, res) => {
    try {
        const messages = await ChatMessage.find({ 
            hallId: new mongoose.Types.ObjectId(req.params.hallId)
        }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Add this route to fetch single discussion hall
// Fix the single hall endpoint
app.get('/api/discussion-halls/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate MongoDB ID format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ message: 'Hall not found' });
        }

        const hall = await DiscussionHall.findOne({
            _id: id,
            status: 'active',
            expiresAt: { $gt: new Date() }
        });

        if (!hall) return res.status(404).json({ message: 'Hall not found' });
        res.json(hall);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/discussion-halls/:id', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        
        if (!admin || !(await bcrypt.compare(password, admin.password))) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Delete hall and its messages
        await DiscussionHall.findByIdAndDelete(req.params.id);
        await ChatMessage.deleteMany({ hallId: req.params.id });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Add WebSocket support (add at top of server.js)
const { createServer } = require('http');
const { Server } = require('socket.io');
const httpServer = createServer(app);
const io = new Server(httpServer);

// In server.js, update the chat-message handler
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('join-hall', (hallId) => {
        socket.join(hallId);
        console.log(`User joined hall ${hallId}`);
    });

    socket.on('chat-message', async (data) => {
    try {
        const isClean = await moderateText(data.content);
        if (!isClean) {
            return socket.emit('chat-error', 'Inappropriate message detected');
        }

        const message = new ChatMessage({
            hallId: data.hallId,
            userNumber: data.userNumber,
            content: data.content
        });

        await message.save();
        io.to(data.hallId).emit('new-message', message);
    } catch (error) {
        console.error('Error saving message:', error);
        socket.emit('chat-error', 'Failed to send message');
    }
});


    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Add this cleanup job (once, at server start)
setInterval(async () => {
    try {
        // Expire old halls but keep them in database
        await DiscussionHall.updateMany(
            { 
                status: 'active',
                expiresAt: { $lt: new Date() }
            },
            { $set: { status: 'expired' } }
        );
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}, 3600000);

// Change app.listen to httpServer.listen
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
