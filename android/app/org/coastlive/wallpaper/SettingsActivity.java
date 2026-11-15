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
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TimePicker;
import android.widget.ScrollView;
import android.widget.TextView;
import org.coastlive.core.Themes;
import org.coastlive.core.Weather;

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

        TextView timeTitle = new TextView(this);
        timeTitle.setText("Time of day");
        timeTitle.setTextSize(20);
        timeTitle.setTypeface(Typeface.DEFAULT_BOLD);
        timeTitle.setPadding(0, (int) (20 * dp), 0, (int) (4 * dp));
        column.addView(timeTitle);

        final boolean fixedNow = "fixed".equals(prefs.getString(CoastService.KEY_TIME_MODE, "auto"));
        final RadioButton auto = new RadioButton(this);
        auto.setId(View.generateViewId());
        auto.setText("Automatic (follow the sun)");
        auto.setTextSize(18);
        final RadioButton fixed = new RadioButton(this);
        fixed.setId(View.generateViewId());
        fixed.setText("Choose a time");
        fixed.setTextSize(18);
        RadioGroup timeGroup = new RadioGroup(this);
        timeGroup.addView(auto);
        timeGroup.addView(fixed);
        (fixedNow ? fixed : auto).setChecked(true);
        column.addView(timeGroup);

        final TimePicker picker = new TimePicker(this);
        picker.setIs24HourView(true);
        int minutes = prefs.getInt(CoastService.KEY_FIXED_MINUTES, 720);
        picker.setHour(minutes / 60);
        picker.setMinute(minutes % 60);
        picker.setEnabled(fixedNow);
        picker.setOnTimeChangedListener(new TimePicker.OnTimeChangedListener() {
            @Override public void onTimeChanged(TimePicker view, int hour, int minute) {
                prefs.edit().putInt(CoastService.KEY_FIXED_MINUTES, hour * 60 + minute).apply();
            }
        });
        column.addView(picker);
        timeGroup.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override public void onCheckedChanged(RadioGroup g, int id) {
                boolean isFixed = id == fixed.getId();
                picker.setEnabled(isFixed);
                prefs.edit().putString(CoastService.KEY_TIME_MODE, isFixed ? "fixed" : "auto").apply();
            }
        });

        TextView weatherTitle = new TextView(this);
        weatherTitle.setText("Weather");
        weatherTitle.setTextSize(20);
        weatherTitle.setTypeface(Typeface.DEFAULT_BOLD);
        weatherTitle.setPadding(0, (int) (20 * dp), 0, (int) (4 * dp));
        column.addView(weatherTitle);
        final Spinner weatherSpinner = new Spinner(this);
        weatherSpinner.setAdapter(new ArrayAdapter<String>(this, android.R.layout.simple_spinner_dropdown_item, Weather.MODE_NAMES));
        String weatherNow = prefs.getString(CoastService.KEY_WEATHER_MODE, "off");
        for (int i = 0; i < Weather.MODES.length; i++) if (Weather.MODES[i].equals(weatherNow)) weatherSpinner.setSelection(i);
        weatherSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                prefs.edit().putString(CoastService.KEY_WEATHER_MODE, Weather.MODES[position]).apply();
            }
            @Override public void onNothingSelected(AdapterView<?> parent) {}
        });
        column.addView(weatherSpinner);
        TextView weatherHint = new TextView(this);
        weatherHint.setText("\u201cMatch the real weather\u201d asks open-meteo.com every 30 minutes and sends your approximate "
            + "position (rounded to about 11 km). Nothing is sent in the other modes.");
        weatherHint.setAlpha(0.7f);
        weatherHint.setPadding(0, (int) (4 * dp), 0, (int) (16 * dp));
        column.addView(weatherHint);

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
