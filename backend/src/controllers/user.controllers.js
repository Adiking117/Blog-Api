import { User } from "../models/user.models.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import {Blog} from "../models/blog.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"

const generateUserAccessRefreshToken = async function(userid){
    try {
        const user = await User.findById(userid);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
    
        user.refreshToken = refreshToken;
    
        await user.save({validation:false})
        return { accessToken,refreshToken }
    } catch (error) {
        throw new ApiError(500,error)
    }
}


const getAllUser = asyncHandler(async(req,res)=>{
    const user = await User.find()
    // console.log(user)
    
    if(user.length === 0){
        throw new ApiError(404,"USer not found")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Users fetched successfully")
    )
})


const registerUser = asyncHandler(async(req,res)=>{
    const { name,username,email,password } = req.body;
    // console.log(req.body)
    if(!(name && username && email && password)){
        throw new ApiError(401,"Fill all the details")
    }
    const existedUser = await User.findOne({username})
    if(existedUser){
        throw new ApiError(402,"User Already exist")
    }

    const imageLocalPath = req.files?.avatar[0]?.path
    // console.log(imageLocalPath)
    if(!imageLocalPath){
        throw new ApiError(400,"Image path not found")
    }

    const avatar = await uploadOnCloudinary(imageLocalPath)
    if(!avatar){
        throw new ApiError(400,"Image required")
    }
    
    const user = await User.create({
        username,
        name,
        email,
        password,
        avatar: avatar.url
    })

    const newuser = await User.findById(user._id).select("-password")
    if(!newuser){
        throw new ApiError(500,"Something went worng")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200,newuser,"User Created Successfully")
    )
})


const loginUser = asyncHandler(async(req,res)=>{
    // console.log(req.body) // input provided in postman
    const {email,password} = req.body
    const user = await User.findOne({email})
    if(!user){
        throw new ApiError(401,"User doesnt exist")
    }

    const isPasswordCorrect = await user.isPasswordValid(password)
    if(!isPasswordCorrect){
        throw new ApiError(201,"Incorrect Password")
    }

    const { accessToken,refreshToken } = await generateUserAccessRefreshToken(user._id)

    const loggedinUser = await User.findById(user._id)
    .select("-password -refreshToken")

    const options = {       // modifible by server
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{
            loggedinUser : loggedinUser ,accessToken,refreshToken
        },"User logged IN Successfully")
    )
})


const logoutUser = asyncHandler(async(req,res)=>{
    const {email}= req.body
    await User.findOneAndUpdate(
        {email},
        {
            $set:{
                refreshToken : undefined
            }
        },
        {
            new : true
        }
    )

    const options = {       
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(200,{},"User logged Out")
    )

})


const updateUserName = asyncHandler(async(req,res)=>{
    const {email,name} = req.body;

    // console.log(req.body)
    
    if(!(name && email)){
        throw new ApiError(401,"Please provide name to be updated")
    }

    // console.log(req.user)
    const updateduser = await User.findOneAndUpdate(
        {email},
        {
            $set:{
                name:name
            }
        },
        {
            new:true
        }
    )
    // console.log(updateduser)

    return res
    .status(200)
    .json(
        new ApiResponse(200,updateduser,"Username updated successfully")
    )

})


const updateUserPassword = asyncHandler(async(req,res)=>{
    const {email , newPassword , oldPassword } = req.body
    if(!(email && newPassword && oldPassword)){
        throw new ApiError(401,"Enter all details to be updated")
    }
    const user = await User.findOne({email})

    const isPasswordCorrect = await user.isPasswordValid(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Password incorrect")
    }

    user.password = newPassword;

    await user.save({ validateBeforeSave:false })

    return res
    .status(200)
    .json(
        new ApiResponse(200,{},"Password Updated Successfully")
    )
})


const deleteUser = asyncHandler(async(req,res)=>{
    const { email,password } = req.body
    // console.log(req.body)
    const user = await User.findOne({email});
    const isPasswordCorrect = await user.isPasswordValid(password)
    if(!isPasswordCorrect){
        throw new ApiError(401,"Password is wrong")
    }
    await User.findOneAndDelete(
        {email},
    )
    return res
    .status(200)
    .json(
        new ApiResponse(200,"User deleted Successfully")
    )
})


const followUser = asyncHandler(async(req,res)=>{
    const { userToBeFollowed,follower } = req.body

    // console.log("follower",follower)
    // console.log("UsertobeFollw",userToBeFollowed)

    if(!userToBeFollowed){
        throw new ApiError(402,"User doesn't exists")
    }

    const userWhoIsFollowing = await User.findOne({username: follower})
    const userToFollow = await User.findOne({username: userToBeFollowed})

    // console.log("userwhoisfollwoing",userWhoIsFollowing)
    // console.log("usertofollow",userToFollow)

    if(!userToFollow){
        throw new ApiError(402,"Username didnt matched")
    }
    if(userWhoIsFollowing.followings.includes(userToBeFollowed)){
        throw new ApiError(401,"You already follow that user")
    }

    userWhoIsFollowing.followings.push(userToFollow.username);
    await userWhoIsFollowing.save();

    userToFollow.followers.push(follower)
    await userToFollow.save();

    return res
    .status(200)
    .json(
        new ApiResponse(200,{},"User followed Successfully")
    )
})


const unfollowUser = asyncHandler(async(req,res)=>{
    const { userToBeUnfollowed,follower } = req.body
    if(!userToBeUnfollowed){
        throw new ApiError(402,"User doesn't exists")
    }

    const userWhoIsUnfollowing = await User.findOne({username: follower})
    const userToUnfollow = await User.findOne({username: userToBeUnfollowed})

    userWhoIsUnfollowing.followings.pop(userToUnfollow.username);
    await userWhoIsUnfollowing.save();

    userToUnfollow.followers.pop(follower)
    await userToUnfollow.save();

    return res
    .status(200)
    .json(
        new ApiResponse(200,{},"User Unfollowed Successfully")
    )
})



const getAllBlog = asyncHandler(async(req,res)=>{
    const blog = await Blog.find();
    if(blog.length === 0){
        throw new ApiError(404,"Blogs not found")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200,blog,"Blogs fetched successfully")
    )
})


const addBlog = asyncHandler(async(req,res)=>{
    // console.log(req.body)
    // console.log(req.files)

    const { title,description,postname,username } = req.body;
    if(!(title && description && postname && username)){
        throw new ApiError(401,"Please provide details")
    }

    const user = await User.findOne({username})

    const imageLocalPath = req.files?.image[0]?.path
    // console.log(imageLocalPath)
    if(!imageLocalPath){
        throw new ApiError(400,"Image path not found")
    }

    const image = await uploadOnCloudinary(imageLocalPath)
    if(!image){
        throw new ApiError(400,"Image required")
    }

    const blog = await Blog.create({
        postname,
        title,
        description,
        image: image.url,
        user:user._id
    })

    const createdBlog = await Blog.findById(blog._id)

    if(!createdBlog){
        throw new ApiError(500,"Something went wrong while uploading")
    }

    console.log("createdBlog  ",createdBlog)

    await User.findByIdAndUpdate(
        user._id,
        { 
            $push: { blogs: blog._id } 
        },
        { new: true }
    );

    return res
    .status(200)
    .json(
        new ApiResponse(200,createdBlog,"Blog Created Successfully")
    )
    
})


const updateBlog = asyncHandler(async(req,res)=>{
    const { postname,title,description } = req.body
    if(!(postname && (title || description))){
        throw new ApiError(401,"Please provide title to be updated")
    }

    const updatedblog = await Blog.findOneAndUpdate(
        {postname},
        {
            $set:{
                title:title,
                description:description
            }
        },
        {
            new:true
        }
    )
    console.log(updatedblog)

    return res
    .status(200)
    .json(
        new ApiResponse(200,updatedblog,"Blog updated successfully")
    )
})


const deleteBlog = asyncHandler(async(req,res)=>{
    const { postname,username } = req.body
    // console.log(req.body)
    if(!(postname && username)){
        throw new ApiError(402,"Please Enter Postname and Username")
    }

    const user = await User.findOne({username})
    const post = await Blog.findOne({postname})
    // console.log("user: ",user)
    // console.log("post: ",post)
    // console.log("userid :",user._id)
    // console.log("postid :",post._id)
   

    if(!(post&&user)){
        throw new ApiError(402,"Not found")
    }

    await User.findByIdAndUpdate(
        user._id,
        {
            $pull : { blogs: post._id}
        },
        {
            new:true
        }
    )
    await Blog.findByIdAndDelete(post._id)
    // await post.findOneAndDelete({postname})


    return res
    .status(200)
    .json(
        new ApiResponse(200,{},"Post Deleted SuccessFully")
    )
})


const likeBlog = asyncHandler(async(req,res)=>{
    const {postname,username} = req.body
    if(!(postname && username)){
        throw new ApiError(400,"Please provide details")
    }

    const user = await User.findOne({username})
    const post = await Blog.findOne({postname})

    if(!(post && user)){
        throw new ApiError(400,"Blog not dound")
    }

    await post.addLike(user.username)

    return res
    .status(200)
    .json(
        new ApiResponse(200,post.likes.length,"Liked the post")
    )
})


const dislikeBlog = asyncHandler(async(req,res)=>{
    const {postname,username} = req.body
    if(!(postname && username)){
        throw new ApiError(400,"Please provide details")
    }

    const user = await User.findOne({username})
    const post = await Blog.findOne({postname})

    if(!(post && user)){
        throw new ApiError(400,"Blog not dound")
    }

    await post.removeLike(user.username)

    return res
    .status(200)
    .json(
        new ApiResponse(200,post.likes.length,"Disliked the post")
    )
})



export {
    getAllUser,
    registerUser,
    loginUser,
    logoutUser,
    updateUserName,
    updateUserPassword,
    deleteUser,
    followUser,
    unfollowUser,
    getAllBlog,
    addBlog,
    updateBlog,
    deleteBlog,
    likeBlog,
    dislikeBlog
}