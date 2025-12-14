const mongoose=require("mongoose");
const validator=require("validator");
const customerchema=new mongoose.Schema({
   firstName:String,
   lastName:String  ,
   email:String ,
phoneNumber:String,
   age:String,
countery:String,
   gender:String,
   userId:String
  
 
   

   
},
   {timestamps:true}
);
module.exports=mongoose.model("Customer",customerchema);
//هنا بيعمل كولكشن اتوماتيك باسم اليوزر فى الداتا بيز