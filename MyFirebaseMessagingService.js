import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import android.util.Log;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "FCM Service";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "Message received from: " + remoteMessage.getFrom());
        // تعامل مع الرسالة الواردة
    }

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "New FCM token: " + token);
        // هنا يمكنك إرسال الرمز إلى الخادم الخاص بك
    }
}
