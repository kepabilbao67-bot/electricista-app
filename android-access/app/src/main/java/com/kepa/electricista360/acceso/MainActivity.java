package com.kepa.electricista360.acceso;
import android.app.*;import android.os.*;import android.content.*;import android.net.*;import android.net.http.*;import android.graphics.*;import android.view.*;import android.webkit.*;import android.widget.*;
public class MainActivity extends Activity{
static final String URL="https://electricista360-nuevo-kepa.vercel.app/acceso",HOST="electricista360-nuevo-kepa.vercel.app";
WebView web;TextView error;LinearLayout fail;ProgressBar spin;
void openChrome(){Intent i=new Intent(Intent.ACTION_VIEW,Uri.parse(URL));i.addCategory(Intent.CATEGORY_BROWSABLE);try{i.setPackage("com.android.chrome");startActivity(i);}catch(Exception e){i.setPackage(null);startActivity(i);}}
void message(String m){error.setText(m+"\nComprueba Internet. No necesitas Tailscale.");fail.setVisibility(View.VISIBLE);spin.setVisibility(View.GONE);}
void reload(){fail.setVisibility(View.GONE);spin.setVisibility(View.VISIBLE);web.loadUrl(URL);}
void btn(LinearLayout row,String title,Runnable action){Button b=new Button(this);b.setText(title);b.setAllCaps(false);b.setOnClickListener(v->action.run());row.addView(b,new LinearLayout.LayoutParams(0,-2,1));}
public void onCreate(Bundle b){super.onCreate(b);WebView.setWebContentsDebuggingEnabled(false);
LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setBackgroundColor(Color.WHITE);setContentView(root);
LinearLayout bar=new LinearLayout(this);bar.setBackgroundColor(Color.rgb(222,239,255));root.addView(bar);btn(bar,"Recargar",()->reload());btn(bar,"Abrir Chrome",()->openChrome());
FrameLayout frame=new FrameLayout(this);root.addView(frame,new LinearLayout.LayoutParams(-1,0,1));web=new WebView(this);frame.addView(web,new FrameLayout.LayoutParams(-1,-1));
WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
spin=new ProgressBar(this);frame.addView(spin,new FrameLayout.LayoutParams(90,90,Gravity.CENTER));
fail=new LinearLayout(this);fail.setOrientation(1);fail.setPadding(30,55,30,20);fail.setBackgroundColor(Color.WHITE);frame.addView(fail,new FrameLayout.LayoutParams(-1,-1));error=new TextView(this);error.setTextColor(Color.BLACK);error.setTextSize(18);fail.addView(error);Button retry=new Button(this);retry.setText("Reintentar");retry.setOnClickListener(v->reload());fail.addView(retry);Button chrome=new Button(this);chrome.setText("Abrir en Chrome");chrome.setOnClickListener(v->openChrome());fail.addView(chrome);fail.setVisibility(View.GONE);
web.setWebViewClient(new WebViewClient(){
public boolean shouldOverrideUrlLoading(WebView w,WebResourceRequest r){Uri u=r.getUrl();if("https".equalsIgnoreCase(u.getScheme())&&HOST.equalsIgnoreCase(u.getHost()))return false;try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception e){}return true;}
public void onPageFinished(WebView w,String u){spin.setVisibility(View.GONE);}
public void onReceivedError(WebView w,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame())message("Error de red: "+e.getDescription());}
public void onReceivedHttpError(WebView w,WebResourceRequest r,WebResourceResponse e){if(r.isForMainFrame()&&e.getStatusCode()>=500)message("Error del servidor: "+e.getStatusCode());}
public void onReceivedSslError(WebView w,SslErrorHandler h,SslError e){h.cancel();message("Error de certificado HTTPS");}
});reload();}
public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
}