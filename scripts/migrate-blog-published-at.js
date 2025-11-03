const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// Blog schema (simplified)
const BlogSchema = new mongoose.Schema({
  title: String,
  content: String,
  status: String,
  publishedAt: Date,
  createdAt: Date,
  updatedAt: Date
}, { timestamps: true });

const Blog = mongoose.model('Blog', BlogSchema);

// Migration function
const migrateBlogPublishedAt = async () => {
  try {
    console.log('Starting migration...');
    
    // Find all published blogs without publishedAt
    const blogsToUpdate = await Blog.find({
      status: 'published',
      publishedAt: { $exists: false }
    });
    
    console.log(`Found ${blogsToUpdate.length} blogs to update`);
    
    // Update each blog
    for (const blog of blogsToUpdate) {
      await Blog.findByIdAndUpdate(blog._id, {
        publishedAt: blog.createdAt || new Date()
      });
      console.log(`Updated blog: ${blog.title}`);
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run migration
connectDB().then(() => {
  migrateBlogPublishedAt();
});

