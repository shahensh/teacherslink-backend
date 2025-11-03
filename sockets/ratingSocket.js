const setupRatingSocket = (io) => {
  console.log('Rating Socket setup initialized');

  // Handle rating-related socket events
  io.on('connection', (socket) => {
    console.log('Rating Socket - User connected:', socket.id);

    // Join school-specific room for rating updates
    socket.on('join_school_rating_room', (schoolId) => {
      socket.join(`school:${schoolId}`);
      console.log(`Rating Socket - User ${socket.id} joined school rating room: ${schoolId}`);
    });

    // Leave school-specific room
    socket.on('leave_school_rating_room', (schoolId) => {
      socket.leave(`school:${schoolId}`);
      console.log(`Rating Socket - User ${socket.id} left school rating room: ${schoolId}`);
    });

    // Handle rating submission (if needed for real-time feedback)
    socket.on('rating_submitted', (data) => {
      console.log('Rating Socket - Rating submitted:', data);
      // Emit to all users in the school's rating room
      io.to(`school:${data.schoolId}`).emit('rating_updated', {
        type: 'rating_updated',
        schoolId: data.schoolId,
        averageRating: data.averageRating,
        newRating: data.rating,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      console.log('Rating Socket - User disconnected:', socket.id);
    });
  });
};

module.exports = setupRatingSocket;


