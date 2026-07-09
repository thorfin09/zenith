import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;

class ApiService {
  // Read VITE_API_URL from .env file or fallback
  static String get baseUrl => dotenv.env['VITE_API_URL'] ?? 'https://zenith-1-wrur.onrender.com/api';

  static Map<String, String> _headers([String? token]) {
    final headers = {'Content-Type': 'application/json'};
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  // --- Auth Service ---
  
  static Future<http.Response> register({
    required String fullName,
    required String username,
    required String password,
    String? phoneNumber,
  }) async {
    final url = Uri.parse('$baseUrl/auth/register');
    final body = jsonEncode({
      'fullName': fullName,
      'username': username,
      'password': password,
      if (phoneNumber != null && phoneNumber.isNotEmpty) 'phoneNumber': phoneNumber,
    });
    return await http.post(url, headers: _headers(), body: body);
  }

  static Future<http.Response> login({
    required String username,
    required String password,
  }) async {
    final url = Uri.parse('$baseUrl/auth/login');
    final body = jsonEncode({
      'username': username,
      'password': password,
    });
    return await http.post(url, headers: _headers(), body: body);
  }

  static Future<bool> checkUsernameAvailable(String username) async {
    try {
      final url = Uri.parse('$baseUrl/auth/check-username/$username');
      final response = await http.get(url, headers: _headers());
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['available'] ?? false;
      }
    } catch (e) {
      print('Username availability check error: $e');
    }
    return false;
  }

  // --- Todos Service ---

  static Future<http.Response> getTodos(String token) async {
    final url = Uri.parse('$baseUrl/todos');
    return await http.get(url, headers: _headers(token));
  }

  static Future<http.Response> createTodo(String token, String text, String date) async {
    final url = Uri.parse('$baseUrl/todos');
    final body = jsonEncode({
      'text': text,
      'date': date,
    });
    return await http.post(url, headers: _headers(token), body: body);
  }

  static Future<http.Response> updateTodo(
    String token,
    String id, {
    bool? completed,
    String? text,
    String? date,
  }) async {
    final url = Uri.parse('$baseUrl/todos/$id');
    final body = jsonEncode({
      if (completed != null) 'completed': completed,
      if (text != null) 'text': text,
      if (date != null) 'date': date,
    });
    return await http.patch(url, headers: _headers(token), body: body);
  }

  static Future<http.Response> deleteTodo(String token, String id) async {
    final url = Uri.parse('$baseUrl/todos/$id');
    return await http.delete(url, headers: _headers(token));
  }

  // --- Streak & Leaderboard Service ---

  static Future<http.Response> syncActiveStatus(String token) async {
    final url = Uri.parse('$baseUrl/users/active');
    final body = jsonEncode({
      'platform': 'android',
      'version': '2.2.3',
    });
    return await http.post(url, headers: _headers(token), body: body);
  }

  static Future<http.Response> getLeaderboard() async {
    final url = Uri.parse('$baseUrl/leaderboard');
    return await http.get(url, headers: _headers());
  }
}
