import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'views/auth_view.dart';
import 'views/todo_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Load .env configuration
  try {
    await dotenv.load(fileName: ".env");
  } catch (e) {
    print('Warning: Failed to load .env file: $e');
  }
  
  // Load saved preferences
  final prefs = await SharedPreferences.getInstance();
  final String? token = prefs.getString('token');
  final String? userJson = prefs.getString('user');
  final String theme = prefs.getString('theme') ?? 'light';
  
  Map<String, dynamic>? user;
  if (userJson != null) {
    try {
      user = jsonDecode(userJson);
    } catch (e) {
      print('Failed to decode cached user profile: $e');
    }
  }

  runApp(ZenithApp(
    initialToken: token,
    initialUser: user,
    initialTheme: theme,
  ));
}

class ZenithApp extends StatefulWidget {
  final String? initialToken;
  final Map<String, dynamic>? initialUser;
  final String initialTheme;

  const ZenithApp({
    super.key,
    this.initialToken,
    this.initialUser,
    required this.initialTheme,
  });

  @override
  State<ZenithApp> createState() => _ZenithAppState();
}

class _ZenithAppState extends State<ZenithApp> {
  late String _themeKey;
  String? _token;
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    _themeKey = widget.initialTheme;
    _token = widget.initialToken;
    _user = widget.initialUser;
  }

  void setTheme(String themeKey) async {
    setState(() {
      _themeKey = themeKey;
    });
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('theme', themeKey);
  }

  void toggleTheme() async {
    final String newThemeKey = _themeKey == 'light' ? 'midnight' : 'light';
    setTheme(newThemeKey);
  }

  void onLoginSuccess(String token, Map<String, dynamic> user) async {
    setState(() {
      _token = token;
      _user = user;
    });

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
    await prefs.setString('user', jsonEncode(user));
  }

  void onLogout() async {
    setState(() {
      _token = null;
      _user = null;
    });

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
    await prefs.remove('cached_todos'); // Clear cached tasks on logout
  }

  // Generate ThemeData dynamically based on selected theme key
  ThemeData _getThemeData(String key) {
    final bool isDark = key != 'light';
    Color primaryColor;
    Color primaryHoverColor;
    Color scaffoldBg;
    Color surfaceColor;
    final Color dangerColor = const Color(0xFFEF4444);

    switch (key) {
      case 'light':
        primaryColor = const Color(0xFF6366F1); // Indigo-600
        primaryHoverColor = const Color(0xFF4F46E5);
        scaffoldBg = const Color(0xFFF9FAFB); // gray-50
        surfaceColor = Colors.white;
        break;
      case 'dark_blue':
        primaryColor = const Color(0xFF6366F1); // Indigo-600
        primaryHoverColor = const Color(0xFF4F46E5);
        scaffoldBg = const Color(0xFF0F172A); // slate-900
        surfaceColor = const Color(0xFF1E293B); // slate-800
        break;
      case 'midnight':
        primaryColor = const Color(0xFFEF4444); // Good Red (Red-500)
        primaryHoverColor = const Color(0xFFDC2626); // Red-600
        scaffoldBg = const Color(0xFF000000); // AMOLED Black Background
        surfaceColor = const Color(0xFF000000); // Complete Black Surface for battery savings
        break;
      case 'amoled_grey':
        primaryColor = const Color(0xFF9CA3AF); // Steel Grey Accent
        primaryHoverColor = const Color(0xFF6B7280);
        scaffoldBg = const Color(0xFF000000); // AMOLED Black Background
        surfaceColor = const Color(0xFF000000); // Complete Black Surface
        break;
      case 'amoled_blue':
        primaryColor = const Color(0xFF2979FF); // Electric Blue Accent
        primaryHoverColor = const Color(0xFF2962FF);
        scaffoldBg = const Color(0xFF000000); // AMOLED Black Background
        surfaceColor = const Color(0xFF000000); // Complete Black Surface
        break;
      case 'forest':
        primaryColor = const Color(0xFF10B981); // Emerald-500
        primaryHoverColor = const Color(0xFF059669); // Emerald-600
        scaffoldBg = const Color(0xFF022C22); // Deep Emerald Black
        surfaceColor = const Color(0xFF064E3B); // Emerald Dark
        break;
      case 'sunset':
        primaryColor = const Color(0xFFF59E0B); // Amber-500
        primaryHoverColor = const Color(0xFFD97706); // Amber-600
        scaffoldBg = const Color(0xFF171717); // Dark neutral grey
        surfaceColor = const Color(0xFF262626); // Neutral grey surface
        break;
      default:
        primaryColor = const Color(0xFF6366F1);
        primaryHoverColor = const Color(0xFF4F46E5);
        scaffoldBg = const Color(0xFFF9FAFB);
        surfaceColor = Colors.white;
    }

    return ThemeData(
      useMaterial3: true,
      brightness: isDark ? Brightness.dark : Brightness.light,
      scaffoldBackgroundColor: scaffoldBg,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        primary: primaryColor,
        secondary: primaryHoverColor,
        surface: surfaceColor,
        error: dangerColor,
        brightness: isDark ? Brightness.dark : Brightness.light,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: surfaceColor,
        foregroundColor: isDark ? Colors.white : const Color(0xFF1F2937),
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      cardTheme: CardThemeData(
        color: surfaceColor,
        elevation: 0.5,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      dividerColor: isDark ? Colors.white.withOpacity(0.12) : const Color(0xFFE5E7EB),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
      ),
    );
  }

  ThemeMode _getThemeMode(String key) {
    return key == 'light' ? ThemeMode.light : ThemeMode.dark;
  }

  @override
  Widget build(BuildContext context) {
    final currentTheme = _getThemeData(_themeKey);
    final isDark = _themeKey != 'light';

    return MaterialApp(
      title: 'ZENITH Daily Tasks',
      debugShowCheckedModeBanner: false,
      themeMode: _getThemeMode(_themeKey),
      theme: _getThemeData('light'),
      darkTheme: currentTheme,
      
      // Routing
      home: _token == null
          ? AuthView(
              onLoginSuccess: onLoginSuccess,
              toggleTheme: toggleTheme,
              isDark: isDark,
            )
          : TodoView(
              token: _token!,
              user: _user!,
              onLogout: onLogout,
              themeKey: _themeKey,
              onChangeTheme: setTheme,
            ),
    );
  }
}
