<!DOCTYPE html>
<html class="light" lang="lo"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Refined Active Duty Status Card</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,typography,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;700&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        primary: "#7C3AED",
                        "background-light": "#F9FAFB",
                        "background-dark": "#111827",
                        "card-light": "#FFFFFF",
                        "card-dark": "#1F2937",
                    },
                    fontFamily: {
                        sans: ["Inter", "Noto Sans Lao", "sans-serif"],
                    },
                    borderRadius: {
                        DEFAULT: "16px",
                    },
                },
            },
        };
    </script>
<style type="text/tailwindcss">
        .timer-glow {
            text-shadow: 0 0 20px rgba(124, 58, 237, 0.1);
        }
        body {
            font-family: 'Inter', 'Noto Sans Lao', sans-serif;
            min-height: 100dvh;
        }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="bg-background-light dark:bg-background-dark flex items-center justify-center p-6 transition-colors duration-300">
<div class="w-full max-w-[390px] mx-auto">
<div class="relative bg-card-light dark:bg-card-dark border border-primary/30 dark:border-primary/50 rounded-[32px] shadow-2xl shadow-purple-500/10 dark:shadow-black/40 overflow-hidden">
<div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20"></div>
<div class="p-8">
<div class="flex justify-between items-start mb-10">
<div class="flex-1 pr-4">
<h1 class="text-primary font-bold text-xl leading-tight">
                            ພວມປະຕິບັດໜ້າທີ່ <br/>
<span class="text-xs uppercase tracking-widest opacity-70 font-semibold">(Special Duty Active)</span>
</h1>
</div>
<div class="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-full border border-red-100 dark:border-red-900/30">
<span class="relative flex h-2 w-2">
<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
<span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
</span>
<span class="text-[10px] font-bold text-red-600 dark:text-red-400 tracking-widest uppercase">Live</span>
</div>
</div>
<div class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 mb-12 border border-slate-100 dark:border-slate-700/50">
<div class="flex items-start gap-4">
<div class="bg-primary/10 dark:bg-primary/20 p-2.5 rounded-xl">
<span class="material-symbols-outlined text-primary text-2xl">location_on</span>
</div>
<div class="flex-1">
<p class="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-1.5">Station / Location</p>
<p class="text-slate-800 dark:text-slate-200 font-bold leading-relaxed text-base">
                                ທະນາຄານ ການຄ້າຕ່າງປະເທດລາວ <br/>
<span class="text-sm font-medium text-slate-500 dark:text-slate-400">VKS25-038 • Main Lobby</span>
</p>
</div>
</div>
</div>
<div class="text-center mb-14">
<h3 class="text-[13px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mb-6">Elapsed Duration</h3>
<div class="timer-glow inline-block">
<span class="text-6xl font-mono font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                            00:00:03
                        </span>
</div>
</div>
<div class="border-t border-slate-100 dark:border-slate-800 pt-8">
<div class="flex items-center justify-center gap-4">
<div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-full">
<span class="material-symbols-outlined text-slate-400 dark:text-slate-500 text-xl">calendar_today</span>
</div>
<div>
<p class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest">Shift Started At</p>
<p class="text-lg font-bold text-slate-800 dark:text-slate-200">10:30 AM</p>
</div>
</div>
</div>
</div>
<div class="bg-slate-50/50 dark:bg-slate-800/20 py-4 text-center border-t border-slate-50 dark:border-slate-800">
<p class="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-[0.3em]">Secure Guard Monitoring Active</p>
</div>
</div>
</div>

</body></html>