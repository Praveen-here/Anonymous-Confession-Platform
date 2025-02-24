
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
        
        // Update the post template in fetchPosts()
postsContainer.innerHTML = posts.map(post => `
    <div class="bg-white p-6 rounded-2xl shadow-md border border-gray-200 mb-4">
        <div class="flex items-center mb-4">
            <svg class="w-8 h-8 mr-2 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3C16.97 3 21 7.03 21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3ZM12 1C5.93 1 1 5.93 1 12C1 18.07 5.93 23 12 23C18.07 23 23 18.07 23 12C23 5.93 18.07 1 12 1ZM13 17V15H11V17H13ZM13 13V7H11V13H13Z"/>
            </svg>
            <p class="font-bold text-gray-800">Anonymous</p>
        </div>
        <p class="text-gray-700 leading-relaxed">${post.content}</p>
        <div class="flex items-center gap-2 mt-4">
                    <button class="like-btn flex items-center group" data-post-id="${post._id}" data-liked="false">
                        <svg class="w-6 h-6 text-gray-600 group-data-[liked=true]:text-red-500" 
                             fill="none" 
                             stroke="currentColor" 
                             viewBox="0 0 24 24"
                             xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" 
                                  stroke-linejoin="round" 
                                  stroke-width="2" 
                                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z">
                            </path>
                        </svg>
                        <span class="like-count ml-1 text-gray-600">${post.likes || 0}</span>
                    </button>
                    <button class="flex items-center text-gray-600 hover:text-blue-500 ml-2" 
                            onclick="toggleCommentSection('${post._id}')">
                        <svg class="w-6 h-6" 
                             fill="none" 
                             stroke="currentColor" 
                             viewBox="0 0 24 24" 
                             xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" 
                                  stroke-linejoin="round" 
                                  stroke-width="2" 
                                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z">
                            </path>
                        </svg>
                    </button>
                </div>
                <div id="commentSection-${post._id}" class="hidden">
                    <input type="text" id="commentInput-${post._id}" 
                           placeholder="Write a comment..." 
                           class="border p-2 rounded w-full mt-2"/>
                    <button onclick="submitComment('${post._id}')" 
                            class="mt-2 bg-blue-500 text-white px-4 py-2 rounded">
                        Submit
                    </button>
                    <div id="commentsContainer-${post._id}" class="mt-2"></div>
                </div>
            </div>
        `).join('');

        // Add event listeners to like buttons
        document.querySelectorAll('.like-btn').forEach(button => {
            button.addEventListener('click', handleLike);
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        alert('Failed to load posts. Please try again later.');
    }
}

async function handleLike(event) {
    const button = event.currentTarget;
    const postId = button.dataset.postId;
    const isLiked = button.dataset.liked === 'true';
    
    try {
        const response = await fetch(`/api/posts/${postId}/like`, { 
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ liked: !isLiked })
        });
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.message || 'Failed to toggle like');
        
        // Update UI
        const svg = button.querySelector('svg');
        const countElement = button.querySelector('.like-count');
        
        if (isLiked) {
            // Switch to outline (dislike)
            svg.innerHTML = `<path stroke-linecap="round" 
                                  stroke-linejoin="round" 
                                  stroke-width="2" 
                                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>`;
            button.dataset.liked = 'false';
        } else {
            // Switch to solid (like)
            svg.innerHTML = `<path stroke-linecap="round" 
                                  stroke-linejoin="round" 
                                  stroke-width="2" 
                                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                             <path fill="currentColor" 
                                   d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.179C3.75 16.5 2.25 13.4 2.25 9.75c0-1.46.223-2.861.635-4.17.447-1.304 1.122-2.433 1.951-3.287l-.014.017a.75.75 0 01.112 1.002l-2.67 3.419a.75.75 0 01-1.15.1l-.165-.132a.75.75 0 01.1-1.15l2.666-2.774a.75.75 0 011.06.004l2.88 2.88a.75.75 0 01-.242 1.199c-1.136.608-2.436.704-3.724.457a2.77 2.77 0 01-1.97-1.913 3.262 3.262 0 00-.864-1.44L7.345 2.22a.75.75 0 011.06-1.06l.015.015c.24.24.369.556.369.891s-.13.65-.369.89L6.22 4.03a1.76 1.76 0 00-.375 1.945c.247.595.915 1.08 1.575 1.177.8.114 1.61.114 2.41 0 .15-.02.3-.04.45-.07l.044-.01c.2-.05.4-.1.6-.15l.035-.01a.75.75 0 01.635.74c0 .033-.002.066-.005.1l-.02.12c-.05.3-.1.6-.15.9-.03.15-.06.3-.09.45-.03.15-.06.3-.09.45-.03.15-.06.3-.09.45-.03.15-.06.3-.09.45l-.01.05a.75.75 0 01-1.44.4l-.01-.03a3.24 3.24 0 00-.45-.9 3.2 3.2 0 00-.6-.6 3.2 3.2 0 00-.9-.45.75.75 0 01.4-1.44l.03.01c.15.03.3.06.45.09.15.03.3.06.45.09.15.03.3.06.45.09.15.03.3.06.45.09.3.05.6.1.9.15.033.006.066.01.1.015a.75.75 0 01.74.635zM15 10.5a3 3 0 11-6 0 3 3 0 016 0z"></path>`;
            button.dataset.liked = 'true';
        }
        
        countElement.textContent = result.likes;
        
    } catch (error) {
        console.error('Error toggling like:', error);
        alert('Failed to toggle like. Please try again.');
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

// Update message handler
window.addEventListener('message', (event) => {
    if (event.data === 'backgroundRefresh') {
        window.dispatchEvent(new Event('backgroundUpdated'));
        const bgImage = document.getElementById('backgroundImage');
        if (bgImage) {
            bgImage.src = bgImage.src.split('?')[0] + `?ts=${Date.now()}`;
        }
    }
    if (event.data === 'bannerRefresh') {
        window.dispatchEvent(new Event('bannerUpdated'));
        const bannerImage = document.getElementById('bannerImage');
        if (bannerImage) {
            bannerImage.src = bannerImage.src.split('?')[0] + `?ts=${Date.now()}`;
        }
    }
});