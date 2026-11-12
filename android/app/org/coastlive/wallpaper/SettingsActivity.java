// SPDX-License-Identifier: GPL-2.0-or-later
package org.coastlive.wallpaper;

import android.app.Activity;
import android.app.WallpaperManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import org.coastlive.core.Themes;

/** Pick a scene and open Android's live-wallpaper preview. Built in code to keep the APK tiny. */
public class SettingsActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        final SharedPreferences prefs = getSharedPreferences(CoastService.PREFS, MODE_PRIVATE);
        String selected = prefs.getString(CoastService.KEY_THEME, "coast");
        float dp = getResources().getDisplayMetrics().density;
        int pad = (int) (20 * dp);

        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("Coast Live");
        title.setTextSize(28);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        column.addView(title);

        TextView hint = new TextView(this);
        hint.setText("An animated pixel-art wallpaper. The sky follows the sun for your time zone, offline.");
        hint.setPadding(0, (int) (8 * dp), 0, (int) (16 * dp));
        column.addView(hint);

        RadioGroup group = new RadioGroup(this);
        for (int i = 0; i < Themes.THEMES.length; i++) {
            RadioButton button = new RadioButton(this);
            button.setId(View.generateViewId());
            button.setText(Themes.THEME_NAMES[i]);
            button.setTag(Themes.THEMES[i]);
            button.setTextSize(18);
            group.addView(button);
            if (Themes.THEMES[i].equals(selected)) button.setChecked(true);
        }
        group.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override public void onCheckedChanged(RadioGroup g, int id) {
                View chosen = g.findViewById(id);
                if (chosen != null) prefs.edit().putString(CoastService.KEY_THEME, (String) chosen.getTag()).apply();
            }
        });
        column.addView(group);

        Button set = new Button(this);
        set.setText("Set wallpaper");
        set.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openPreview(); }
        });
        column.addView(set);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(column);
        setContentView(scroll);
    }

    void openPreview() {   // not private: old D8 versions choke on nest-based access from the listener
        Intent intent = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER);
        intent.putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, new ComponentName(this, CoastService.class));
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            startActivity(new Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER));
        }
    }
}
