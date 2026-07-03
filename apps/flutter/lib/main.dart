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
  late ThemeMode _themeMode;
  String? _token;
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    _themeMode = widget.initialTheme == 'dark' ? ThemeMode.dark : ThemeMode.light;
    _token = widget.initialToken;
    _user = widget.initialUser;
  }

  void toggleTheme() async {
    final newMode = _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    setState(() {
      _themeMode = newMode;
    });
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('theme', newMode == ThemeMode.dark ? 'dark' : 'light');
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
  }

  @override
  Widget build(BuildContext context) {
    // Custom Zenith Theme definitions matching web design
    final Color primaryColor = const Color(0xFF6366F1); // Indigo-600
    final Color primaryHoverColor = const Color(0xFF4F46E5);
    final Color successColor = const Color(0xFF10B981); // Emerald-500
    final Color dangerColor = const Color(0xFFEF4444); // Red-500

    return MaterialApp(
      title: 'ZENITH Daily Tasks',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      
      // Light Theme
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF9FAFB), // gray-50
        colorScheme: ColorScheme.fromSeed(
          seedColor: primaryColor,
          primary: primaryColor,
          secondary: primaryHoverColor,
          surface: Colors.white,
          error: dangerColor,
          brightness: Brightness.light,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF1F2937),
          elevation: 0,
          scrolledUnderElevation: 0,
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primaryColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
      ),

      // Dark Theme
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A), // slate-900
        colorScheme: ColorScheme.fromSeed(
          seedColor: primaryColor,
          primary: primaryColor,
          secondary: primaryHoverColor,
          surface: const Color(0xFF1E293B), // slate-800
          error: dangerColor,
          brightness: Brightness.dark,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1E293B),
          foregroundColor: Colors.white,
          elevation: 0,
          scrolledUnderElevation: 0,
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1E293B),
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primaryColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
      ),

      // Routing
      home: _token == null
          ? AuthView(
              onLoginSuccess: onLoginSuccess,
              toggleTheme: toggleTheme,
              isDark: _themeMode == ThemeMode.dark,
            )
          : TodoView(
              token: _token!,
              user: _user!,
              onLogout: onLogout,
              toggleTheme: toggleTheme,
              isDark: _themeMode == ThemeMode.dark,
            ),
    );
  }
}
