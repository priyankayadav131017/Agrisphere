// Microphone Diagnostic Script
// Run this in your browser console (F12) to check microphone status

console.log('🔍 AgriSphere Voice Assistant Diagnostics');
console.log('==========================================');

// 1. Check browser support
console.log('\n1. Browser Support Check:');
if ('webkitSpeechRecognition' in window) {
    console.log('✅ webkitSpeechRecognition supported');
} else if ('SpeechRecognition' in window) {
    console.log('✅ SpeechRecognition supported');
} else {
    console.log('❌ Speech Recognition NOT supported');
    console.log('💡 Solution: Use Chrome or Edge browser');
}

// 2. Check HTTPS/localhost
console.log('\n2. Protocol Check:');
if (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.log('✅ Protocol is secure (HTTPS or localhost)');
} else {
    console.log('❌ Insecure protocol detected');
    console.log('💡 Solution: Use HTTPS or localhost for development');
}

// 3. Check microphone permissions
console.log('\n3. Microphone Permission Check:');
if (navigator.permissions) {
    navigator.permissions.query({ name: 'microphone' }).then(function(result) {
        console.log('Microphone permission:', result.state);
        if (result.state === 'granted') {
            console.log('✅ Microphone permission granted');
        } else if (result.state === 'prompt') {
            console.log('⚠️ Microphone permission will be requested');
        } else {
            console.log('❌ Microphone permission denied');
            console.log('💡 Solution: Click the microphone icon in address bar and allow access');
        }
    });
} else {
    console.log('⚠️ Cannot check permissions (older browser)');
}

// 4. Test basic microphone access
console.log('\n4. Testing Microphone Access:');
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function(stream) {
            console.log('✅ Microphone access successful');
            stream.getTracks().forEach(track => track.stop()); // Stop the stream
        })
        .catch(function(error) {
            console.log('❌ Microphone access failed:', error.name);
            if (error.name === 'NotAllowedError') {
                console.log('💡 Solution: Allow microphone permission in browser settings');
            } else if (error.name === 'NotFoundError') {
                console.log('💡 Solution: Check if microphone is connected and working');
            }
        });
} else {
    console.log('❌ getUserMedia not supported');
}

// 5. Browser info
console.log('\n5. Browser Information:');
console.log('User Agent:', navigator.userAgent);
console.log('Platform:', navigator.platform);

console.log('\n🔧 Quick Fixes:');
console.log('1. Use Chrome or Edge browser');
console.log('2. Allow microphone permission when prompted');
console.log('3. Check Windows microphone settings');
console.log('4. Make sure microphone is not muted');
console.log('5. Try refreshing the page');