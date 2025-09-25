/**
 * SparkleWash Notification Templates
 * Generates dynamic messages for customers
 */

class NotificationService {
  
  // Wash completion message
  static getWashCompletionMessage(customerName, washType, location, date, remainingWashes) {
    const washDate = new Date(date).toLocaleDateString();
    const washTime = new Date(date).toLocaleTimeString();
    
    return {
      title: "🚗 Car Wash Completed - SparkleWash",
      message: `Hi ${customerName}! Your ${washType} car wash has been completed successfully at ${location} on ${washDate} at ${washTime}. 
      
✅ Wash Status: Completed
📍 Location: ${location}
⏰ Completed At: ${washTime}
🔄 Remaining Washes: ${remainingWashes} this month

Thank you for choosing SparkleWash! 
Call us: +91-XXXXXXXXXX for any queries.`,
      
      templateData: {
        customerName,
        washType,
        location,
        washDate,
        washTime,
        remainingWashes
      }
    };
  }
  
  // Wash reminder message
  static getWashReminderMessage(customerName, scheduledDate, location, washType) {
    const date = new Date(scheduledDate).toLocaleDateString();
    const time = new Date(scheduledDate).toLocaleTimeString();
    
    return {
      title: "🔔 Wash Reminder - SparkleWash",
      message: `Hi ${customerName}! Reminder: Your ${washType} car wash is scheduled for tomorrow.
      
📅 Date: ${date}
⏰ Time: ${time}
📍 Location: ${location}
🚗 Service: ${washType}

Our washer will arrive at your doorstep. Please ensure your car is accessible.
SparkleWash - Sparkling Clean, Every Time!`,
      
      templateData: {
        customerName,
        scheduledDate: date,
        scheduledTime: time,
        location,
        washType
      }
    };
  }
  
  // Subscription expiry warning
  static getSubscriptionExpiryMessage(customerName, expiryDate, packageName, remainingWashes) {
    const expiry = new Date(expiryDate).toLocaleDateString();
    
    return {
      title: "⚠️ Subscription Expiring Soon - SparkleWash",
      message: `Hi ${customerName}! Your ${packageName} subscription expires on ${expiry}.
      
📦 Package: ${packageName}
📅 Expires: ${expiry}
🔄 Remaining Washes: ${remainingWashes}

Renew now to continue enjoying premium car wash services at your doorstep!
Call: +91-XXXXXXXXXX or visit our app.`,
      
      templateData: {
        customerName,
        packageName,
        expiryDate: expiry,
        remainingWashes
      }
    };
  }
  
  // Welcome message for new customers
  static getWelcomeMessage(customerName, packageName, startDate, washDays) {
    const start = new Date(startDate).toLocaleDateString();
    const daysText = washDays.join(", ");
    
    return {
      title: "🎉 Welcome to SparkleWash!",
      message: `Hi ${customerName}! Welcome to SparkleWash family! 
      
✅ Subscription Active: ${packageName}
📅 Started: ${start}
📋 Wash Days: ${daysText}
🚗 Service: At your doorstep

Your car will be sparkling clean every wash day!
Download our app for booking and tracking.`,
      
      templateData: {
        customerName,
        packageName,
        startDate: start,
        washDays: daysText
      }
    };
  }
  
  // Wash rescheduled message
  static getRescheduleMessage(customerName, oldDate, newDate, reason) {
    const oldDateTime = new Date(oldDate);
    const newDateTime = new Date(newDate);
    
    return {
      title: "📅 Wash Rescheduled - SparkleWash",
      message: `Hi ${customerName}! Your car wash has been rescheduled.
      
❌ Original: ${oldDateTime.toLocaleDateString()} at ${oldDateTime.toLocaleTimeString()}
✅ New Date: ${newDateTime.toLocaleDateString()} at ${newDateTime.toLocaleTimeString()}
📝 Reason: ${reason}

We apologize for the inconvenience. Our washer will be there at the new time.
SparkleWash - Your satisfaction is our priority!`,
      
      templateData: {
        customerName,
        oldDate: oldDateTime.toLocaleString(),
        newDate: newDateTime.toLocaleString(),
        reason
      }
    };
  }
  
  // Monthly wash summary
  static getMonthlySummary(customerName, totalWashes, remainingWashes, nextWashDate) {
    const nextWash = new Date(nextWashDate).toLocaleDateString();
    
    return {
      title: "📊 Monthly Wash Summary - SparkleWash",
      message: `Hi ${customerName}! Here's your monthly wash summary:
      
✅ Washes Completed: ${totalWashes}
🔄 Washes Remaining: ${remainingWashes}
📅 Next Wash: ${nextWash}

Keep your car sparkling with SparkleWash!
Rate your last wash experience in our app.`,
      
      templateData: {
        customerName,
        totalWashes,
        remainingWashes,
        nextWashDate: nextWash
      }
    };
  }
}

module.exports = NotificationService;