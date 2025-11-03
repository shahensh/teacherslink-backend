const setupBlogSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('Blog Socket - User connected:', socket.id);

    // Join admin blog room
    socket.on('join_admin_blog_room', () => {
      socket.join('admin_blog_room');
      console.log('Blog Socket - User joined admin blog room:', socket.id);
    });

    // Leave admin blog room
    socket.on('leave_admin_blog_room', () => {
      socket.leave('admin_blog_room');
      console.log('Blog Socket - User left admin blog room:', socket.id);
    });

    // Join public blog room (for public blog viewing)
    socket.on('join_blog_room', () => {
      socket.join('blog_room');
      console.log('Blog Socket - User joined blog room:', socket.id);
    });

    // Leave public blog room
    socket.on('leave_blog_room', () => {
      socket.leave('blog_room');
      console.log('Blog Socket - User left blog room:', socket.id);
    });

    // Handle blog creation
    socket.on('blog_created', (blog) => {
      // Notify admin room
      socket.to('admin_blog_room').emit('blog_created', blog);
      // Notify public room if published
      if (blog.status === 'published') {
        socket.to('blog_room').emit('new_blog_published', blog);
      }
    });

    // Handle blog update
    socket.on('blog_updated', (blog) => {
      // Notify admin room
      socket.to('admin_blog_room').emit('blog_updated', blog);
      // Notify public room if published
      if (blog.status === 'published') {
        socket.to('blog_room').emit('blog_updated', blog);
      }
    });

    // Handle blog deletion
    socket.on('blog_deleted', (blogId) => {
      // Notify admin room
      socket.to('admin_blog_room').emit('blog_deleted', blogId);
      // Notify public room
      socket.to('blog_room').emit('blog_deleted', blogId);
    });

    // Handle blog like
    socket.on('blog_liked', (blogId, likeCount) => {
      socket.to('blog_room').emit('blog_liked', blogId, likeCount);
    });

    // Handle blog comment
    socket.on('blog_commented', (blogId, comment) => {
      socket.to('blog_room').emit('blog_commented', blogId, comment);
    });

    // Handle blog view
    socket.on('blog_viewed', (blogId, viewCount) => {
      socket.to('blog_room').emit('blog_viewed', blogId, viewCount);
    });

    socket.on('disconnect', () => {
      console.log('Blog Socket - User disconnected:', socket.id);
    });
  });
};

module.exports = { setupBlogSocket };


