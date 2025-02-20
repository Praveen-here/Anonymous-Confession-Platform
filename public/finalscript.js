document.addEventListener("DOMContentLoaded", function () {
    const menuButton = document.getElementById("menuButton");
    const sidebar = document.getElementById("sidebar");
    const aboutButton = document.getElementById("aboutButton");
    const aboutSection = document.getElementById("aboutSection");
    const aboutBackButton = document.getElementById("aboutBackButton");

    // Toggle Sidebar
    menuButton.addEventListener("click", function (event) {
        event.stopPropagation(); // Prevent immediate close
        sidebar.classList.remove("hidden");
    });

    // Close Sidebar when clicking outside of it
    document.addEventListener("click", function (event) {
        if (!sidebar.contains(event.target) && !menuButton.contains(event.target)) {
            sidebar.classList.add("hidden");
        }
    });

    // Prevent Sidebar from closing when clicking inside it
    sidebar.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    // Close Sidebar when clicking an option inside it
    function closeSidebar() {
        sidebar.classList.add("hidden");
    }

    aboutButton.addEventListener("click", function () {
        closeSidebar(); // Hide sidebar
        aboutSection.classList.remove("hidden"); // Show About section
    });

    aboutBackButton.addEventListener("click", function () {
        aboutSection.classList.add("hidden"); // Hide About section
    });

    // Close sidebar when clicking on "Admin Login" link
    document.querySelector("h2[onclick]").addEventListener("click", closeSidebar);
});

document.addEventListener('DOMContentLoaded', () => {
    // Toggle create post form
    document.getElementById('createPostButton').addEventListener('click', () => {
        document.getElementById('createPost').classList.toggle('hidden');
    });

    document.getElementById('createPostBackButton').addEventListener('click', () => {
        document.getElementById('createPost').classList.add('hidden');
    });

    // Submit post
    document.getElementById("submitPostButton").addEventListener("click", async () => {
        const postContent = document.getElementById("postContent").value.trim();
    
        if (!postContent) {
            alert("Post content cannot be empty!");
            return;
        }
    
        try {
            const response = await fetch("/api/posts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ content: postContent })
            });
    
            const result = await response.json();
            if (response.ok) {
                alert("Post created successfully!");
                window.location.reload(); // Refresh to show the new post
            } else {
                alert("Error: " + result.message);
            }
        } catch (error) {
            console.error("Error submitting post:", error);
            alert("Failed to submit post.");
        }
    });

    // Fetch and display posts
    fetchPosts();
});

async function fetchPosts() {
    try {
        const response = await fetch('/api/posts');
        if (!response.ok) throw new Error('Failed to fetch posts');
        const posts = await response.json();
        const postsContainer = document.getElementById('postsContainer');
        postsContainer.innerHTML = posts.map(post => `
            <div class="bg-white p-4 rounded-lg shadow-lg border border-black">
                <div class="flex items-center mb-4">
                    <div class="w-8 h-8 bg-black rounded-full mr-2"></div>
                    <p class="font-bold">Anonymous</p>
                </div>
                <p>${post.content}</p>
                <button class="mt-2 text-blue-500" onclick="toggleCommentSection('${post._id}')">Comment</button>
                <div id="commentSection-${post._id}" class="hidden">
                    <input type="text" id="commentInput-${post._id}" placeholder="Write a comment..." class="border p-2 rounded w-full"/>
                    <button onclick="submitComment('${post._id}')" class="mt-2 bg-blue-500 text-white p-1 rounded">Submit</button>
                    <div id="commentsContainer-${post._id}"></div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error fetching posts:', error);
        alert('Failed to load posts. Please try again later.');
    }
}

function toggleCommentSection(postId) {
    document.getElementById(`commentSection-${postId}`).classList.toggle('hidden');
    fetchComments(postId);
}

async function submitComment(postId) {
    const commentInput = document.getElementById(`commentInput-${postId}`);
    const comment = commentInput.value.trim();
    
    if (!comment) {
        alert('Comment cannot be empty!');
        return;
    }

    try {
        const response = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: comment })  
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to add comment');

        commentInput.value = '';
        fetchComments(postId); // Refresh comments after submitting
    } catch (error) {
        console.error('Error submitting comment:', error);
    }
}

async function fetchComments(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}/comments`);
        if (!response.ok) throw new Error('Failed to fetch comments');

        const comments = await response.json();
        const commentsContainer = document.getElementById(`commentsContainer-${postId}`);
        
        // Added 🗨 symbol before each comment
        commentsContainer.innerHTML = comments.map(comment => 
            `<p class="text-gray-600 mt-2">🗨 ${comment.content}</p>`
        ).join('');
    } catch (error) {
        console.error('Error fetching comments:', error);
    }
}