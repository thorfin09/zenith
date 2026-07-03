import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import '../services/api_service.dart';

class AuthView extends StatefulWidget {
  final Function(String, Map<String, dynamic>) onLoginSuccess;
  final VoidCallback toggleTheme;
  final bool isDark;

  const AuthView({
    super.key,
    required this.onLoginSuccess,
    required this.toggleTheme,
    required this.isDark,
  });

  @override
  State<AuthView> createState() => _AuthViewState();
}

class _AuthViewState extends State<AuthView> {
  bool _isLogin = true; // Switch between Login and Signup
  bool _loading = false;
  String? _errorMessage;
  bool? _usernameAvailable;

  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _phoneNumberController = TextEditingController();

  @override
  void dispose() {
    _fullNameController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _phoneNumberController.dispose();
    super.dispose();
  }

  void _checkUsernameAvailability(String username) async {
    if (username.length < 3 || _isLogin) return;
    
    final isAvailable = await ApiService.checkUsernameAvailable(username);
    if (mounted) {
      setState(() {
        _usernameAvailable = isAvailable;
      });
    }
  }

  void _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _errorMessage = null;
      _loading = true;
    });

    try {
      if (_isLogin) {
        // --- Standard Login Flow ---
        final response = await ApiService.login(
          username: _usernameController.text.trim(),
          password: _passwordController.text,
        );
        final data = jsonDecode(response.body);

        if (response.statusCode == 200) {
          widget.onLoginSuccess(data['token'], data['user']);
        } else {
          setState(() {
            _errorMessage = data['message'] ?? 'Login failed. Please check credentials.';
          });
        }
      } else {
        // --- Registration Flow ---
        if (_passwordController.text != _confirmPasswordController.text) {
          setState(() {
            _errorMessage = 'Passwords do not match';
            _loading = false;
          });
          return;
        }

        if (_usernameAvailable == false) {
          setState(() {
            _errorMessage = 'Username is already taken';
            _loading = false;
          });
          return;
        }

        final response = await ApiService.register(
          fullName: _fullNameController.text.trim(),
          username: _usernameController.text.trim(),
          password: _passwordController.text,
          phoneNumber: _phoneNumberController.text.trim(),
        );

        final data = jsonDecode(response.body);

        if (response.statusCode == 201) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Account created! Please sign in.')),
          );
          setState(() {
            _isLogin = true;
            _passwordController.clear();
            _confirmPasswordController.clear();
            _fullNameController.clear();
          });
        } else {
          setState(() {
            _errorMessage = data['message'] ?? 'Registration failed';
          });
        }
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network error: Connection refused or API is down.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  void _enterDemoMode() {
    // Replicate React App's enterDemo functionality
    widget.onLoginSuccess(
      'demo', 
      {
        'fullName': 'Guest User',
        'username': 'guest',
      }
    );
  }

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email'],
    serverClientId: '294705223499-bon46rd275f0ihgsq9clr0ets0pvh1uc.apps.googleusercontent.com',
  );

  void _handleGoogleLogin() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        setState(() {
          _loading = false;
        });
        return;
      }

      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final String? idToken = googleAuth.idToken;

      if (idToken == null) {
        throw Exception('Could not retrieve Google ID Token.');
      }

      // Send credential token to same Node backend
      final url = Uri.parse('${ApiService.baseUrl}/auth/google');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'credential': idToken}),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        widget.onLoginSuccess(data['token'], data['user']);
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Google Sign-In backend verification failed.';
        });
      }
    } on PlatformException catch (e) {
      setState(() {
        _loading = false;
      });
      _showFirebaseSetupDialog(e.message ?? e.code);
    } catch (e) {
      setState(() {
        _loading = false;
        _errorMessage = 'Google Sign-In failed: $e';
      });
    }
  }

  void _showFirebaseSetupDialog(String errorDetails) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Row(
            children: const [
              Icon(Icons.warning_amber_rounded, color: Colors.amber),
              SizedBox(width: 8),
              Text('Google Sign-In Setup'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Google Sign-In on mobile requires native API configuration.',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Text(
                'Details: $errorDetails\n\n'
                'To launch on the Play Store, you must:\n'
                '1. Register your app (com.example.zenith) in Firebase Console.\n'
                '2. Add your SHA-1 key fingerprint certificate to Firebase.\n'
                '3. Download the google-services.json file and place it in the android/app/ directory.',
                style: const TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 12),
              const Text(
                'For local testing, please use standard Username/Password or click "Try Demo Mode"!',
                style: TextStyle(fontStyle: FontStyle.italic, fontSize: 13),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('OK'),
            )
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = widget.isDark;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'ZENITH',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
            color: theme.colorScheme.primary,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode),
            onPressed: widget.toggleTheme,
          ),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Welcome Header Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24.0),
                decoration: BoxDecoration(
                  color: theme.cardTheme.color,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: isDark ? Colors.black26 : Colors.black12,
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    )
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: AnimatedSize(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                      Text(
                        _isLogin ? 'Welcome Back' : 'Join Zenith',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _isLogin 
                            ? 'Enter your details to access your tasks'
                            : 'Create an account to stay organized',
                        style: TextStyle(
                          color: theme.colorScheme.onSurface.withOpacity(0.6),
                          fontSize: 14,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),

                      // Full Name (Signup Only)
                      if (!_isLogin) ...[
                        TextFormField(
                          controller: _fullNameController,
                          decoration: const InputDecoration(
                            labelText: 'Full Name',
                            prefixIcon: Icon(Icons.person_outline),
                            border: OutlineInputBorder(),
                          ),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) {
                              return 'Please enter your full name';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Username
                      TextFormField(
                        controller: _usernameController,
                        decoration: InputDecoration(
                          labelText: 'Username',
                          prefixIcon: const Icon(Icons.person_add_alt_1_outlined),
                          border: const OutlineInputBorder(),
                          suffixIcon: !_isLogin && _usernameAvailable != null
                              ? Icon(
                                  _usernameAvailable! ? Icons.check_circle : Icons.error,
                                  color: _usernameAvailable! ? Colors.green : Colors.red,
                                )
                              : null,
                        ),
                        onChanged: _checkUsernameAvailability,
                        validator: (val) {
                          if (val == null || val.trim().isEmpty) {
                            return 'Please enter a username';
                          }
                          if (val.length < 3) {
                            return 'Username must be at least 3 characters';
                          }
                          return null;
                        },
                      ),
                      if (!_isLogin && _usernameAvailable != null) ...[
                        const SizedBox(height: 4),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8.0),
                          child: Text(
                            _usernameAvailable! ? '✓ Username available' : '✗ Username taken',
                            style: TextStyle(
                              color: _usernameAvailable! ? Colors.green : Colors.red,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),

                      // Password
                      TextFormField(
                        controller: _passwordController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Password',
                          prefixIcon: Icon(Icons.lock_outline),
                          border: OutlineInputBorder(),
                        ),
                        validator: (val) {
                          if (val == null || val.isEmpty) {
                            return 'Please enter a password';
                          }
                          if (val.length < 6) {
                            return 'Password must be at least 6 characters';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),

                      // Confirm Password & Phone (Signup Only)
                      if (!_isLogin) ...[
                        TextFormField(
                          controller: _confirmPasswordController,
                          obscureText: true,
                          decoration: const InputDecoration(
                            labelText: 'Confirm Password',
                            prefixIcon: Icon(Icons.lock_outline),
                            border: OutlineInputBorder(),
                          ),
                          validator: (val) {
                            if (val == null || val.isEmpty) {
                              return 'Please confirm your password';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _phoneNumberController,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            labelText: 'Phone (Optional)',
                            prefixIcon: Icon(Icons.phone_outlined),
                            border: OutlineInputBorder(),
                            hintText: '+1 (555) 000-0000',
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Error message container
                      if (_errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.error.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: theme.colorScheme.error.withOpacity(0.3)),
                          ),
                          child: Text(
                            _errorMessage!,
                            style: TextStyle(color: theme.colorScheme.error, fontSize: 13, fontWeight: FontWeight.w600),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Action Button
                      ElevatedButton(
                        onPressed: _loading ? null : _handleSubmit,
                        child: _loading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                             : Text(_isLogin ? 'Sign In' : 'Create Account', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
              ),
            ),

              const SizedBox(height: 20),

              // OR divider
              Row(
                children: [
                  Expanded(child: Divider(color: theme.colorScheme.onSurface.withOpacity(0.2))),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    child: Text('OR', style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.5), fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                  Expanded(child: Divider(color: theme.colorScheme.onSurface.withOpacity(0.2))),
                ],
              ),

              const SizedBox(height: 20),

              // Mock Google Login Button
              OutlinedButton.icon(
                icon: Image.asset(
                  'assets/google_logo.png', // Fallback, will draw placeholder icon if not found
                  height: 18,
                  errorBuilder: (context, error, stackTrace) => const Icon(Icons.g_mobiledata, size: 24, color: Colors.blue),
                ),
                label: Text(
                  _isLogin ? 'Sign in with Google' : 'Sign up with Google',
                  style: TextStyle(color: theme.colorScheme.onSurface, fontWeight: FontWeight.bold),
                ),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48),
                  side: BorderSide(color: theme.colorScheme.onSurface.withOpacity(0.2)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: _handleGoogleLogin,
              ),

              const SizedBox(height: 12),

              // Try Demo Mode Button
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48),
                  side: BorderSide(color: theme.colorScheme.primary, width: 2),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: _enterDemoMode,
                child: Text(
                  'Try Demo Mode',
                  style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.bold, fontSize: 15),
                ),
              ),

              const SizedBox(height: 24),

              // Bottom toggle
              TextButton(
                onPressed: () {
                  setState(() {
                    _isLogin = !_isLogin;
                    _errorMessage = null;
                    _usernameAvailable = null;
                  });
                },
                child: RichText(
                  text: TextSpan(
                    style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.7)),
                    children: [
                      TextSpan(text: _isLogin ? "Don't have an account? " : "Already have an account? "),
                      TextSpan(
                        text: _isLogin ? 'Sign Up' : 'Sign In',
                        style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.bold),
                      )
                    ],
                  ),
                ),
              )
            ],
          ),
        ),
      ),
    );
  }
}
