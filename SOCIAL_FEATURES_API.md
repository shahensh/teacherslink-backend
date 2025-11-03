# Social Features API Documentation

This document outlines the new social features API endpoints for the Teachers Link platform, including real-time profile management, posts, likes, comments, and shares.

## Table of Contents
- [Authentication](#authentication)
- [Profile Image Uploads](#profile-image-uploads)
- [Posts Management](#posts-management)
- [Social Interactions](#social-interactions)
- [Real-time Events](#real-time-events)
- [Frontend Integration](#frontend-integration)

## Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Profile Image Uploads

### Upload Profile Image (School)
```http
POST /api/schools/upload-profile-image
Content-Type: multipart/form-data

profileImage: <file>
```

**Response:**
```json
{
  "success": true,
  "message": "Profile image uploaded successfully",
  "profileImage": "https://cloudinary.com/..."
}
```

### Upload Cover Image (School)
```http
POST /api/schools/upload-cover-image
Content-Type: multipart/form-data

coverImage: <file>
```

### Upload Profile Image (Teacher)
```http
POST /api/teachers/upload-profile-image
Content-Type: multipart/form-data

profileImage: <file>
```

### Upload Cover Image (Teacher)
```http
POST /api/teachers/upload-cover-image
Content-Type: multipart/form-data

coverImage: <file>
```

## Posts Management

### Create Post
```http
POST /api/posts
Content-Type: multipart/form-data

caption: "Your post caption"
tags: "tag1,tag2,tag3"
privacy: "public" | "connections" | "private"
location: {"name": "Location Name", "coordinates": [lng, lat]}
media: <file1>, <file2>, ... (up to 10 files)
```

**Response:**
```json
{
  "success": true,
  "message": "Post created successfully",
  "post": {
    "_id": "post_id",
    "caption": "Your post caption",
    "media": [
      {
        "url": "https://cloudinary.com/...",
        "type": "image",
        "alt": "filename.jpg"
      }
    ],
    "tags": ["tag1", "tag2", "tag3"],
    "privacy": "public",
    "likesCount": 0,
    "commentsCount": 0,
    "sharesCount": 0,
    "author": {
      "_id": "user_id",
      "email": "user@example.com",
      "role": "school"
    },
    "authorProfile": {
      "_id": "profile_id",
      "schoolName": "School Name"
    },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get Feed
```http
GET /api/posts/feed?page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "posts": [
    {
      "_id": "post_id",
      "caption": "Post content",
      "media": [...],
      "likesCount": 5,
      "commentsCount": 2,
      "sharesCount": 1,
      "likedByMe": "like" | null,
      "author": {...},
      "authorProfile": {...},
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

### Get Profile Posts
```http
GET /api/posts/profile/:profileId?page=1&limit=10
```

### Update Post
```http
PUT /api/posts/:postId
Content-Type: multipart/form-data

caption: "Updated caption"
tags: "new,tags"
media: <new_file> (optional)
```

### Delete Post
```http
DELETE /api/posts/:postId
```

## Social Interactions

### Like/Unlike Post
```http
POST /api/posts/:postId/like
Content-Type: application/json

{
  "type": "like" | "love" | "laugh" | "wow" | "sad" | "angry"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Post liked",
  "liked": true,
  "likesCount": 6
}
```

### Add Comment
```http
POST /api/posts/:postId/comments
Content-Type: application/json

{
  "text": "Your comment text",
  "parentComment": "parent_comment_id" // optional, for replies
}
```

**Response:**
```json
{
  "success": true,
  "message": "Comment added",
  "comment": {
    "_id": "comment_id",
    "text": "Your comment text",
    "user": {
      "_id": "user_id",
      "email": "user@example.com",
      "role": "teacher"
    },
    "likesCount": 0,
    "repliesCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get Comments
```http
GET /api/posts/:postId/comments?page=1&limit=20
```

### Share Post
```http
POST /api/posts/:postId/share
Content-Type: application/json

{
  "caption": "Optional share caption",
  "type": "share" | "quote" | "story"
}
```

## Real-time Events

The backend uses Socket.IO for real-time updates. Connect to the socket server and listen for these events:

### Connection Setup
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5001', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events to Listen For

#### New Post
```javascript
socket.on('new_post', (data) => {
  console.log('New post:', data);
  // data.type = 'post_created'
  // data.data = post object
  // data.timestamp = ISO string
});
```

#### Post Liked
```javascript
socket.on('post_liked', (data) => {
  console.log('Post liked:', data);
  // data.type = 'post_liked'
  // data.postId = post ID
  // data.liked = true/false
  // data.likesCount = new count
  // data.userId = user who liked
});
```

#### Post Commented
```javascript
socket.on('post_commented', (data) => {
  console.log('Post commented:', data);
  // data.type = 'post_commented'
  // data.postId = post ID
  // data.comment = comment object
  // data.userId = user who commented
});
```

#### Post Shared
```javascript
socket.on('post_shared', (data) => {
  console.log('Post shared:', data);
  // data.type = 'post_shared'
  // data.postId = post ID
  // data.share = share object
  // data.userId = user who shared
});
```

#### Image Uploaded
```javascript
socket.on('image_uploaded', (data) => {
  console.log('Image uploaded:', data);
  // data.type = 'image_uploaded'
  // data.imageType = 'profile' | 'cover'
  // data.url = image URL
  // data.userId = user ID
});
```

#### Notifications
```javascript
socket.on('notification', (data) => {
  console.log('Notification:', data);
  // data.type = 'post_liked' | 'post_commented' | 'post_shared' | 'connection_request'
  // data.message = notification message
  // data.userId = user who performed action
});
```

### Events to Emit

#### Join Post Room (for real-time updates on specific posts)
```javascript
socket.emit('join_post', postId);
```

#### Leave Post Room
```javascript
socket.emit('leave_post', postId);
```

#### Typing Indicator
```javascript
socket.emit('typing_comment', {
  postId: 'post_id',
  isTyping: true
});
```

## Frontend Integration

### React Hook Example
```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export const useSocialSocket = (token) => {
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!token) return;

    const newSocket = io('http://localhost:5001', {
      auth: { token }
    });

    newSocket.on('notification', (data) => {
      setNotifications(prev => [...prev, data]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  return { socket, notifications };
};
```

### Post Creation with Real-time Updates
```javascript
const createPost = async (postData) => {
  const formData = new FormData();
  formData.append('caption', postData.caption);
  formData.append('tags', postData.tags.join(','));
  formData.append('privacy', postData.privacy);
  
  if (postData.media) {
    postData.media.forEach(file => {
      formData.append('media', file);
    });
  }

  const response = await fetch('/api/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const result = await response.json();
  
  if (result.success) {
    // The socket will automatically emit 'new_post' event
    // Other users will receive real-time updates
    return result.post;
  }
};
```

### Like Post with Real-time Updates
```javascript
const likePost = async (postId, type = 'like') => {
  const response = await fetch(`/api/posts/${postId}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ type })
  });

  const result = await response.json();
  
  if (result.success) {
    // The socket will automatically emit 'post_liked' event
    // All users viewing this post will see real-time updates
    return result;
  }
};
```

## Database Models

### Post Model
```javascript
{
  _id: ObjectId,
  author: ObjectId (ref: User),
  authorProfile: ObjectId (ref: School/Teacher),
  authorProfileType: String ('School' | 'Teacher'),
  caption: String,
  media: [{
    url: String,
    type: String ('image' | 'video'),
    thumbnail: String,
    alt: String
  }],
  tags: [String],
  privacy: String ('public' | 'connections' | 'private'),
  likesCount: Number,
  commentsCount: Number,
  sharesCount: Number,
  isPublished: Boolean,
  isEdited: Boolean,
  editedAt: Date,
  location: {
    name: String,
    coordinates: [Number, Number]
  },
  mentions: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

### Like Model
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  post: ObjectId (ref: Post),
  type: String ('like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry'),
  createdAt: Date
}
```

### Comment Model
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  post: ObjectId (ref: Post),
  text: String,
  parentComment: ObjectId (ref: Comment), // for replies
  likesCount: Number,
  repliesCount: Number,
  isEdited: Boolean,
  editedAt: Date,
  mentions: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

### Share Model
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  post: ObjectId (ref: Post),
  caption: String,
  type: String ('share' | 'quote' | 'story'),
  createdAt: Date
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message" // in development
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate-limited to 100 requests per 15 minutes per IP address. Real-time events are not rate-limited but should be used responsibly.

## Security Notes

1. All file uploads are validated for type and size
2. Images are automatically optimized and stored on Cloudinary
3. User authentication is required for all social interactions
4. Users can only modify their own posts and profiles
5. Real-time events include user authentication
6. All inputs are sanitized and validated

