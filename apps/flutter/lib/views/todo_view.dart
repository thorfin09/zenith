import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:ota_update/ota_update.dart';
import '../models/todo.dart';
import '../services/api_service.dart';
import 'settings_view.dart';

class TodoView extends StatefulWidget {
  final String token;
  final Map<String, dynamic> user;
  final VoidCallback onLogout;
  final String themeKey;
  final Function(String) onChangeTheme;

  const TodoView({
    super.key,
    required this.token,
    required this.user,
    required this.onLogout,
    required this.themeKey,
    required this.onChangeTheme,
  });

  @override
  State<TodoView> createState() => _TodoViewState();
}

class _TodoViewState extends State<TodoView> {
  late bool _isDemo;
  List<Todo> _todos = [];
  bool _loading = false;
  bool _isRefreshing = false;
  String? _errorMessage;
  
  bool _showUpdateBanner = false;
  String? _latestVersionTag;
  String? _latestVersionDownloadUrl;
  String? _latestVersionReleaseNotes;
  String? _latestVersionReleaseName;

  final FlutterLocalNotificationsPlugin _flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

  // Selected date defaults to local YYYY-MM-DD
  late String _selectedDate;
  late List<DateTime> _dates;
  final ScrollController _scrollController = ScrollController();
  late PageController _pageController;
  bool _isAnimatingPage = false;

  // Dialog controllers
  final TextEditingController _taskController = TextEditingController();
  
  // Inline edit controllers
  String? _editingTodoId;
  final TextEditingController _editController = TextEditingController();

  String _toLocalDateString(DateTime date) {
    return DateFormat('yyyy-MM-dd').format(date);
  }

  @override
  void initState() {
    super.initState();
    _isDemo = widget.token == 'demo';
    _selectedDate = _toLocalDateString(DateTime.now());
    
    // Generate dates: 30 days back + today + 100 days forward
    _dates = [];
    final today = DateTime.now();
    for (int i = -30; i <= 100; i++) {
      _dates.add(today.add(Duration(days: i)));
    }

    final initialIndex = _dates.indexWhere((d) => _toLocalDateString(d) == _selectedDate);
    _pageController = PageController(initialPage: initialIndex != -1 ? initialIndex : 0);

    if (_isDemo) {
      _initializeDemoTodos();
    } else {
      _loadCachedTodos().then((_) {
        _fetchTodos();
      });
    }

    // Scroll to "Today" after layout build
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToActiveDate(instant: true));

    // Initialize push notifications
    if (!_isDemo) {
      _initNotifications();
    }

    // Silent GitHub release check on app start
    if (!_isDemo) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _checkUpdateSilently();
      });
    }
  }

  Future<void> _loadCachedTodos() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedJson = prefs.getString('cached_todos');
      if (cachedJson != null) {
        final List<dynamic> data = jsonDecode(cachedJson);
        setState(() {
          _todos = data.map((json) => Todo.fromJson(json)).toList();
        });
      }
    } catch (e) {
      print('Failed to load cached todos: $e');
    }
  }

  Future<void> _updateCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = jsonEncode(_todos.map((t) => t.toJson()).toList());
      await prefs.setString('cached_todos', jsonStr);
    } catch (e) {
      print('Failed to update todo cache: $e');
    }
  }

  void _openSettings() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SettingsView(
          themeKey: widget.themeKey,
          onChangeTheme: widget.onChangeTheme,
        ),
      ),
    );
  }

  void _initNotifications() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
    );

    await _flutterLocalNotificationsPlugin.initialize(initializationSettings);

    final androidPlugin = _flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin != null) {
      await androidPlugin.requestNotificationsPermission();
    }
  }

  Future<void> _showNotification(String title, String body) async {
    const AndroidNotificationDetails androidNotificationDetails =
        AndroidNotificationDetails(
      'zenith_updates_channel',
      'Zenith Update Alerts',
      channelDescription: 'Notifications for Zenith app updates',
      importance: Importance.max,
      priority: Priority.high,
      ticker: 'ticker',
      playSound: true,
    );
    const NotificationDetails notificationDetails =
        NotificationDetails(android: androidNotificationDetails);
    await _flutterLocalNotificationsPlugin.show(
      0,
      title,
      body,
      notificationDetails,
    );
  }

  Future<void> _checkUpdateSilently() async {
    try {
      final response = await http.get(
        Uri.parse('https://api.github.com/repos/thorfin09/zenith/releases/latest'),
        headers: {'Accept': 'application/vnd.github.v3+json'},
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final latestTag = data['tag_name'] as String;
        final releaseName = data['name'] ?? latestTag;
        final htmlUrl = data['html_url'] as String;
        final notes = data['body'] ?? 'No release notes provided.';
        const currentVersion = '2.2.0';

        if (_isNewerVersion(currentVersion, latestTag)) {
          // Find the APK file asset if available
          String? apkUrl;
          final assets = data['assets'] as List?;
          if (assets != null) {
            for (var asset in assets) {
              final name = asset['name'] as String;
              if (name.endsWith('.apk')) {
                apkUrl = asset['browser_download_url'] as String;
                break;
              }
            }
          }

          final downloadUrl = apkUrl ?? htmlUrl;

          if (mounted) {
            setState(() {
              _showUpdateBanner = true;
              _latestVersionTag = latestTag;
              _latestVersionDownloadUrl = downloadUrl;
              _latestVersionReleaseNotes = notes;
              _latestVersionReleaseName = releaseName;
            });
            
            // Post a system push notification (plays system sound)
            _showNotification(
              'Zenith Update Available!',
              'Version $latestTag is ready. Tap to download and install.',
            );
            
            // Pop up the update dialog alert immediately on launch
            _showUpdateDialog(latestTag, releaseName, downloadUrl, notes);
          }
        }
      }
    } catch (e) {
      print('Silent update check error: $e');
    }
  }

  void _showUpdateDialog(
    String tag,
    String releaseName,
    String downloadUrl,
    String notes,
  ) {
    showDialog(
      context: context,
      builder: (ctx) {
        final theme = Theme.of(ctx);
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              Icon(Icons.system_update_alt, color: theme.colorScheme.primary),
              const SizedBox(width: 10),
              const Text('Update Available!'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'A new version ($tag) is ready.',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 8),
                Text('Release: $releaseName'),
                const SizedBox(height: 12),
                const Divider(),
                const SizedBox(height: 8),
                const Text(
                  'What\'s New:',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  notes,
                  style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurface.withOpacity(0.8)),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                'Later',
                style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.6)),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                Navigator.pop(ctx);
                _downloadAndInstallUpdate(downloadUrl);
              },
              child: const Text('Update Now'),
            ),
          ],
        );
      },
    );
  }

  void _downloadAndInstallUpdate(String downloadUrl) {
    double progress = 0.0;
    String statusText = 'Starting download...';
    late StateSetter dialogSetState;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setState) {
            dialogSetState = setState;
            final theme = Theme.of(context);
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: [
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      value: progress > 0 ? progress / 100 : null,
                      strokeWidth: 3,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: 16),
                  const Text('Downloading Update'),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    statusText,
                    style: const TextStyle(fontSize: 14),
                  ),
                  const SizedBox(height: 12),
                  LinearProgressIndicator(
                    value: progress > 0 ? progress / 100 : null,
                    backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(height: 8),
                  if (progress > 0)
                    Align(
                      alignment: Alignment.centerRight,
                      child: Text(
                        '${progress.toInt()}%',
                        style: TextStyle(
                          fontSize: 12,
                          color: theme.colorScheme.onSurface.withOpacity(0.6),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
    );

    try {
      OtaUpdate()
          .execute(
        downloadUrl,
        destinationFilename: 'zenith-update.apk',
      )
          .listen(
        (OtaEvent event) {
          if (!mounted) return;
          
          dialogSetState(() {
            switch (event.status) {
              case OtaStatus.DOWNLOADING:
                progress = double.tryParse(event.value ?? '0') ?? 0.0;
                statusText = 'Downloading update files...';
                break;
              case OtaStatus.INSTALLING:
                statusText = 'Opening installer...';
                Navigator.of(context, rootNavigator: true).pop();
                break;
              case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
                Navigator.of(context, rootNavigator: true).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Permission denied to install package.'),
                    backgroundColor: Colors.redAccent,
                  ),
                );
                break;
              default:
                Navigator.of(context, rootNavigator: true).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Update failed: ${event.status} (${event.value})'),
                    backgroundColor: Colors.redAccent,
                  ),
                );
                break;
            }
          });
        },
        onError: (e) {
          if (mounted) {
            Navigator.of(context, rootNavigator: true).pop();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Download error: $e'),
                backgroundColor: Colors.redAccent,
              ),
            );
          }
        },
      );
    } catch (e) {
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to initialize OTA update: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  bool _isNewerVersion(String current, String latest) {
    try {
      final cleanCurrent = current.startsWith('v') ? current.substring(1) : current;
      final cleanLatest = latest.startsWith('v') ? latest.substring(1) : latest;

      final currentParts = cleanCurrent.split('+')[0].split('.').map(int.parse).toList();
      final latestParts = cleanLatest.split('+')[0].split('.').map(int.parse).toList();

      for (int i = 0; i < 3; i++) {
        final c = currentParts.length > i ? currentParts[i] : 0;
        final l = latestParts.length > i ? latestParts[i] : 0;
        if (l > c) return true;
        if (l < c) return false;
      }
    } catch (e) {
      print('Error parsing version: $e');
    }
    return false;
  }

  @override
  void dispose() {
    _pageController.dispose();
    _scrollController.dispose();
    _taskController.dispose();
    _editController.dispose();
    super.dispose();
  }

  void _initializeDemoTodos() {
    final todayStr = _toLocalDateString(DateTime.now());
    final yesterdayStr = _toLocalDateString(DateTime.now().subtract(const Duration(days: 1)));
    
    setState(() {
      _todos = [
        Todo(id: 'd1', userId: 'demo', text: 'Welcome to ZENITH Daily! 📅', completed: false, date: todayStr),
        Todo(id: 'd2', userId: 'demo', text: 'Click the checkbox to complete a task', completed: true, date: todayStr),
        Todo(id: 'd3', userId: 'demo', text: 'An overdue task from yesterday!', completed: false, date: yesterdayStr),
      ];
    });
  }

  Future<void> _fetchTodos() async {
    if (_loading || _isRefreshing) return;

    setState(() {
      if (_todos.isEmpty) {
        _loading = true;
      } else {
        _isRefreshing = true;
      }
      _errorMessage = null;
    });

    try {
      final response = await ApiService.getTodos(widget.token);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        setState(() {
          _todos = data.map((json) => Todo.fromJson(json)).toList();
        });
        
        // Cache successfully retrieved tasks
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cached_todos', response.body);
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        _handleSessionExpired();
      } else {
        setState(() {
          _errorMessage = 'Failed to load tasks from server.';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network error: Server is unreachable.';
      });
    } finally {
      setState(() {
        _loading = false;
        _isRefreshing = false;
      });
    }
  }

  void _handleSessionExpired() {
    if (!mounted) return;
    
    // Clear token, cached todos and redirect
    widget.onLogout();
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Session expired. Please sign in again.'),
        backgroundColor: Colors.orange,
      ),
    );
  }

  // --- Scroll Actions ---

  void _scrollToActiveDate({bool instant = false, bool center = false}) {
    final todayIndex = _dates.indexWhere((d) => _toLocalDateString(d) == _selectedDate);
    if (todayIndex != -1) {
      double offset;
      if (center) {
        // Calculate offset to center the card in the viewport
        final screenWidth = MediaQuery.of(context).size.width;
        final viewportWidth = screenWidth - 96.0; // Subtract chevrons padding
        offset = (todayIndex * 80.0) - (viewportWidth / 2.0) + 40.0;
      } else {
        // Position active card at the far-left
        offset = todayIndex * 80.0;
      }

      if (_scrollController.hasClients) {
        if (instant) {
          _scrollController.jumpTo(offset.clamp(0.0, _scrollController.position.maxScrollExtent));
        } else {
          _scrollController.animateTo(
            offset.clamp(0.0, _scrollController.position.maxScrollExtent),
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      }
    }
  }

  void _navigateDate(int direction) {
    final current = DateTime.parse('${_selectedDate}T00:00:00');
    final updated = current.add(Duration(days: direction));
    final dateStr = _toLocalDateString(updated);
    final index = _dates.indexWhere((d) => _toLocalDateString(d) == dateStr);
    if (index != -1) {
      _isAnimatingPage = true;
      setState(() {
        _selectedDate = dateStr;
      });
      _scrollToActiveDate(center: true);
      _pageController.animateToPage(
        index,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutQuad,
      ).then((_) {
        _isAnimatingPage = false;
      });
    }
  }

  void _resetToToday() {
    final todayStr = _toLocalDateString(DateTime.now());
    final index = _dates.indexWhere((d) => _toLocalDateString(d) == todayStr);
    if (index != -1) {
      _isAnimatingPage = true;
      setState(() {
        _selectedDate = todayStr;
      });
      _scrollToActiveDate();
      _pageController.animateToPage(
        index,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutQuad,
      ).then((_) {
        _isAnimatingPage = false;
      });
    }
  }

  // --- Optimistic Operations ---

  Future<void> _handleAddTodo(String text) async {
    if (text.trim().isEmpty) return;
    
    final tempId = 'temp-${DateTime.now().millisecondsSinceEpoch}';
    final newTodo = Todo(
      id: tempId,
      userId: widget.user['id'] ?? 'demo',
      text: text,
      completed: false,
      date: _selectedDate,
      createdAt: DateTime.now(),
    );

    if (_isDemo) {
      setState(() {
        _todos.insert(0, newTodo);
      });
      return;
    }

    final previousTodos = List<Todo>.from(_todos);
    setState(() {
      _todos.insert(0, newTodo);
    });

    try {
      final response = await ApiService.createTodo(widget.token, text, _selectedDate);
      if (response.statusCode == 201) {
        final saved = Todo.fromJson(jsonDecode(response.body));
        setState(() {
          final index = _todos.indexWhere((t) => t.id == tempId);
          if (index != -1) _todos[index] = saved;
        });
        _updateCache();
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        setState(() {
          _todos = previousTodos;
        });
        _handleSessionExpired();
      } else {
        setState(() {
          _todos = previousTodos;
          _errorMessage = 'Failed to save task to server.';
        });
      }
    } catch (e) {
      setState(() {
        _todos = previousTodos;
        _errorMessage = 'Network connection lost.';
      });
    }
  }

  Future<void> _handleToggleTodo(Todo todo) async {
    final previousCompleted = todo.completed;

    if (_isDemo) {
      setState(() {
        todo.completed = !previousCompleted;
      });
      return;
    }

    final previousTodos = _todos.map((t) => Todo(
      id: t.id,
      userId: t.userId,
      text: t.text,
      completed: t.completed,
      date: t.date,
      createdAt: t.createdAt
    )).toList();

    setState(() {
      todo.completed = !previousCompleted;
    });

    try {
      final response = await ApiService.updateTodo(widget.token, todo.id, completed: !previousCompleted);
      if (response.statusCode == 200) {
        _updateCache();
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        setState(() {
          _todos = previousTodos;
        });
        _handleSessionExpired();
      } else {
        setState(() {
          _todos = previousTodos;
          _errorMessage = 'Server failed to update task status.';
        });
      }
    } catch (e) {
      setState(() {
        _todos = previousTodos;
        _errorMessage = 'Network update error.';
      });
    }
  }

  Future<void> _handleDeleteTodo(Todo todo) async {
    if (_isDemo) {
      setState(() {
        _todos.removeWhere((t) => t.id == todo.id);
      });
      return;
    }

    final previousTodos = List<Todo>.from(_todos);
    setState(() {
      _todos.removeWhere((t) => t.id == todo.id);
    });

    try {
      final response = await ApiService.deleteTodo(widget.token, todo.id);
      if (response.statusCode == 200) {
        _updateCache();
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        setState(() {
          _todos = previousTodos;
        });
        _handleSessionExpired();
      } else {
        setState(() {
          _todos = previousTodos;
          _errorMessage = 'Failed to delete task from server.';
        });
      }
    } catch (e) {
      setState(() {
        _todos = previousTodos;
        _errorMessage = 'Network connection failed.';
      });
    }
  }

  Future<void> _handleRescheduleTodo(Todo todo) async {
    final todayStr = _toLocalDateString(DateTime.now());
    
    if (_isDemo) {
      setState(() {
        todo.date = todayStr;
      });
      return;
    }

    final previousTodos = _todos.map((t) => Todo(
      id: t.id,
      userId: t.userId,
      text: t.text,
      completed: t.completed,
      date: t.date,
      createdAt: t.createdAt
    )).toList();

    setState(() {
      todo.date = todayStr;
    });

    try {
      final response = await ApiService.updateTodo(widget.token, todo.id, date: todayStr);
      if (response.statusCode == 200) {
        _updateCache();
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        setState(() {
          _todos = previousTodos;
        });
        _handleSessionExpired();
      } else {
        setState(() {
          _todos = previousTodos;
          _errorMessage = 'Server failed to reschedule task.';
        });
      }
    } catch (e) {
      setState(() {
        _todos = previousTodos;
        _errorMessage = 'Network connection error.';
      });
    }
  }

  Future<void> _handleEditTodo(Todo todo, String newText) async {
    if (newText.trim().isEmpty || newText == todo.text) return;

    if (_isDemo) {
      setState(() {
        todo.text = newText;
      });
      return;
    }

    final previousTodos = _todos.map((t) => Todo(
      id: t.id,
      userId: t.userId,
      text: t.text,
      completed: t.completed,
      date: t.date,
      createdAt: t.createdAt
    )).toList();

    setState(() {
      todo.text = newText;
    });

    try {
      final response = await ApiService.updateTodo(widget.token, todo.id, text: newText);
      if (response.statusCode == 200) {
        _updateCache();
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        setState(() {
          _todos = previousTodos;
        });
        _handleSessionExpired();
      } else {
        setState(() {
          _todos = previousTodos;
          _errorMessage = 'Failed to update task description.';
        });
      }
    } catch (e) {
      setState(() {
        _todos = previousTodos;
        _errorMessage = 'Network error.';
      });
    }
  }

  // --- Utility dialog triggers ---

  void _startInlineEdit(Todo todo) {
    setState(() {
      _editingTodoId = todo.id;
      _editController.text = todo.text;
    });
  }

  void _cancelInlineEdit() {
    setState(() {
      _editingTodoId = null;
      _editController.clear();
    });
  }

  void _saveInlineEdit(Todo todo) {
    final text = _editController.text.trim();
    if (text.isNotEmpty && text != todo.text) {
      _handleEditTodo(todo, text);
    }
    _cancelInlineEdit();
  }

  Widget _buildInlineInputSection() {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          )
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _taskController,
              decoration: const InputDecoration(
                hintText: 'Add a new task...',
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              ),
              onSubmitted: (val) {
                if (val.trim().isNotEmpty) {
                  _handleAddTodo(val.trim());
                  _taskController.clear();
                }
              },
            ),
          ),
          IconButton(
            icon: Icon(Icons.add_circle, color: theme.colorScheme.primary, size: 28),
            onPressed: () {
              final val = _taskController.text.trim();
              if (val.isNotEmpty) {
                _handleAddTodo(val);
                _taskController.clear();
              }
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    final todayStr = _toLocalDateString(DateTime.now());
    final isLocked = _selectedDate.compareTo(todayStr) < 0;


    // Avatar initials
    final String fullName = widget.user['fullName'] ?? 'Guest';
    final initials = fullName
        .split(' ')
        .where((n) => n.isNotEmpty)
        .map((n) => n[0])
        .join('')
        .toUpperCase();
    final avatarText = initials.length > 2 ? initials.substring(0, 2) : initials;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Text(
              'ZENITH',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.primary,
                letterSpacing: 1.0,
              ),
            ),
            if (_isDemo) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'DEMO',
                  style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              )
            ]
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isDemo ? null : _fetchTodos,
            tooltip: 'Refresh tasks',
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: _openSettings,
            tooltip: 'Settings',
          ),
          PopupMenuButton<String>(
            icon: CircleAvatar(
              backgroundColor: theme.colorScheme.primary.withOpacity(0.2),
              child: Text(
                avatarText.isEmpty ? 'U' : avatarText,
                style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
            onSelected: (value) {
              if (value == 'logout') {
                widget.onLogout();
              } else if (value == 'today') {
                _resetToToday();
              } else if (value == 'settings') {
                _openSettings();
              }
            },
            itemBuilder: (BuildContext context) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(fullName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    Text('@${widget.user['username'] ?? 'guest'}', style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.6), fontSize: 12)),
                    const Divider(),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'today',
                child: Row(
                  children: [
                    Icon(Icons.today, size: 18),
                    SizedBox(width: 8),
                    Text('Go to Today'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'settings',
                child: Row(
                  children: [
                    Icon(Icons.settings_outlined, size: 18),
                    SizedBox(width: 8),
                    Text('Settings'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 18, color: theme.colorScheme.error),
                    const SizedBox(width: 8),
                    Text(
                      _isDemo ? 'Exit Demo' : 'Sign Out',
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: Column(
        children: [
          if (_isRefreshing)
            LinearProgressIndicator(
              color: theme.colorScheme.primary,
              backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
              minHeight: 2.0,
            ),
          // Banner for Demo Mode
          if (_isDemo)
            Container(
              width: double.infinity,
              color: theme.colorScheme.primary.withOpacity(0.15),
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
              child: Text(
                'Demo mode: Changes are saved in memory and will be lost on exit.',
                style: TextStyle(color: theme.colorScheme.primary, fontSize: 12, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
            ),

          // Banner for Update Notification (Notification alert inside the home screen)
          if (_showUpdateBanner && _latestVersionTag != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: theme.colorScheme.primary.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  Icon(Icons.system_update_alt, color: theme.colorScheme.primary, size: 22),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Update Available: $_latestVersionTag',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'A new version of Zenith is ready. Tap to install.',
                          style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withOpacity(0.7)),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      _showUpdateDialog(
                        _latestVersionTag!,
                        _latestVersionReleaseName ?? _latestVersionTag!,
                        _latestVersionDownloadUrl!,
                        _latestVersionReleaseNotes ?? '',
                      );
                    },
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Update', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () {
                      setState(() {
                        _showUpdateBanner = false;
                      });
                    },
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    splashRadius: 16,
                  ),
                ],
              ),
            ),

          // Date Navigator Strip
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: theme.cardTheme.color,
              border: Border(bottom: BorderSide(color: theme.dividerColor, width: 0.5)),
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        DateFormat('MMMM yyyy').format(DateTime.parse('${_selectedDate}T00:00:00')),
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      TextButton(
                        onPressed: _resetToToday,
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text('Today', style: TextStyle(fontWeight: FontWeight.bold)),
                      )
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left, size: 20),
                      onPressed: () => _navigateDate(-1),
                    ),
                    Expanded(
                      child: SizedBox(
                        height: 72,
                        child: ListView.builder(
                          controller: _scrollController,
                          scrollDirection: Axis.horizontal,
                          itemCount: _dates.length,
                          itemBuilder: (context, index) {
                            final date = _dates[index];
                            final dateStr = _toLocalDateString(date);
                            final isActive = dateStr == _selectedDate;
                            final isToday = _toLocalDateString(DateTime.now()) == dateStr;

                            return GestureDetector(
                              onTap: () {
                                if (_selectedDate != dateStr) {
                                  _isAnimatingPage = true;
                                  setState(() {
                                    _selectedDate = dateStr;
                                  });
                                  _scrollToActiveDate(center: true);
                                  _pageController.animateToPage(
                                    index,
                                    duration: const Duration(milliseconds: 300),
                                    curve: Curves.easeOutQuad,
                                  ).then((_) {
                                    _isAnimatingPage = false;
                                  });
                                }
                              },
                              child: AnimatedScale(
                                scale: isActive ? 1.05 : 0.95,
                                duration: const Duration(milliseconds: 200),
                                curve: Curves.easeOutBack,
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 250),
                                  curve: Curves.easeInOut,
                                  width: 72,
                                  margin: const EdgeInsets.symmetric(horizontal: 4),
                                  decoration: BoxDecoration(
                                    color: isActive
                                        ? theme.colorScheme.primary
                                        : theme.colorScheme.surface,
                                    border: isToday && !isActive
                                        ? Border.all(color: theme.colorScheme.primary, width: 1.5)
                                        : Border.all(color: theme.colorScheme.onSurface.withOpacity(0.08)),
                                    borderRadius: BorderRadius.circular(12),
                                    boxShadow: isActive
                                        ? [
                                            BoxShadow(
                                              color: theme.colorScheme.primary.withOpacity(0.35),
                                              blurRadius: 8,
                                              offset: const Offset(0, 3),
                                            )
                                          ]
                                        : [],
                                  ),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        DateFormat('E').format(date).toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: isActive
                                              ? Colors.white
                                              : theme.colorScheme.onSurface.withOpacity(0.5),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        date.day.toString(),
                                        style: TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: isActive ? Colors.white : theme.colorScheme.onSurface,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        DateFormat('MMM').format(date),
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w600,
                                          color: isActive
                                              ? Colors.white.withOpacity(0.8)
                                              : theme.colorScheme.onSurface.withOpacity(0.4),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right, size: 20),
                      onPressed: () => _navigateDate(1),
                    ),
                  ],
                )
              ],
            ),
          ),

          // Locked Indicator or Todo Input Section
          if (isLocked)
            Container(
              width: double.infinity,
              color: Colors.red.withOpacity(0.04),
              padding: const EdgeInsets.all(12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.lock_outline, size: 16, color: theme.colorScheme.onSurface.withOpacity(0.5)),
                  const SizedBox(width: 8),
                  Text(
                    'Past dates are locked. You cannot edit or add tasks.',
                    style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.5), fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            )
          else
            _buildInlineInputSection(),

          if (_errorMessage != null)
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                decoration: BoxDecoration(color: Colors.red.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            ),

          // Tasks List
          Expanded(
            child: _loading
                ? Center(child: CircularProgressIndicator(color: theme.colorScheme.primary))
                : PageView.builder(
                    controller: _pageController,
                    itemCount: _dates.length,
                    onPageChanged: (index) {
                      if (!_isAnimatingPage) {
                        final dateStr = _toLocalDateString(_dates[index]);
                        setState(() {
                          _selectedDate = dateStr;
                        });
                        _scrollToActiveDate(center: true, instant: true);
                      }
                    },
                    itemBuilder: (context, pageIndex) {
                      final pageDate = _dates[pageIndex];
                      final pageDateStr = _toLocalDateString(pageDate);
                      final isPageToday = pageDateStr == todayStr;

                      final pageDateTodos = _todos.where((t) => t.date == pageDateStr).toList();
                      final pageOverdueTodos = isPageToday
                          ? _todos.where((t) => !t.completed && t.date.compareTo(todayStr) < 0).toList()
                          : <Todo>[];

                      return RefreshIndicator(
                        onRefresh: _isDemo ? () async {} : _fetchTodos,
                        color: theme.colorScheme.primary,
                        child: ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(16),
                          children: [
                            // Overdue Section
                            if (pageOverdueTodos.isNotEmpty) ...[
                              Row(
                                children: [
                                  const Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 18),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Pending from Past',
                                    style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.7), fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              ...pageOverdueTodos.map((todo) => _buildTodoCard(todo, isOverdue: true)),
                              const SizedBox(height: 16),
                            ],

                            // Main selected date title
                            Text(
                              isPageToday
                                  ? "Today's Tasks"
                                  : "Tasks for ${DateFormat('d MMM').format(pageDate)}",
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            const SizedBox(height: 8),

                            if (pageDateTodos.isEmpty)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 40.0),
                                child: Center(
                                  child: Text(
                                    'No tasks for this day. Enjoy your day! ✨',
                                    style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.5), fontSize: 14),
                                  ),
                                ),
                              )
                            else
                              ...pageDateTodos.map((todo) => _buildTodoCard(todo, isOverdue: false)),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildTodoCard(Todo todo, {required bool isOverdue}) {
    final theme = Theme.of(context);
    final isEditing = _editingTodoId == todo.id;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      elevation: isEditing ? 2 : 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isEditing
              ? theme.colorScheme.primary.withOpacity(0.5)
              : theme.colorScheme.onSurface.withOpacity(0.06),
          width: isEditing ? 1.5 : 1,
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: isEditing
            ? null
            : GestureDetector(
                onTap: () => _handleToggleTodo(todo),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeInOut,
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: todo.completed ? theme.colorScheme.primary : Colors.transparent,
                    border: Border.all(
                      color: todo.completed ? theme.colorScheme.primary : theme.colorScheme.onSurface.withOpacity(0.4),
                      width: 2,
                    ),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: AnimatedScale(
                    scale: todo.completed ? 1.0 : 0.0,
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeOutBack,
                    child: const Icon(Icons.check, size: 16, color: Colors.white),
                  ),
                ),
              ),
        title: isEditing
            ? TextField(
                controller: _editController,
                autofocus: true,
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  hintText: 'Edit task...',
                  contentPadding: EdgeInsets.zero,
                ),
                onSubmitted: (_) => _saveInlineEdit(todo),
              )
            : AnimatedDefaultTextStyle(
                style: TextStyle(
                  decoration: todo.completed ? TextDecoration.lineThrough : null,
                  color: todo.completed
                      ? theme.colorScheme.onSurface.withOpacity(0.4)
                      : theme.colorScheme.onSurface,
                  fontSize: 15,
                  fontWeight: todo.completed ? FontWeight.normal : FontWeight.w600,
                  fontFamily: theme.textTheme.bodyMedium?.fontFamily,
                ),
                duration: const Duration(milliseconds: 200),
                child: Text(todo.text),
              ),
        subtitle: isOverdue && !isEditing
            ? Padding(
                padding: const EdgeInsets.only(top: 4.0),
                child: Text(
                  'Scheduled: ${DateFormat('d MMM').format(DateTime.parse('${todo.date}T00:00:00'))}',
                  style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.w600),
                ),
              )
            : null,
        trailing: isEditing
            ? Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.check, color: Colors.green),
                    onPressed: () => _saveInlineEdit(todo),
                    tooltip: 'Save description',
                  ),
                  IconButton(
                    icon: Icon(Icons.close, color: theme.colorScheme.error),
                    onPressed: _cancelInlineEdit,
                    tooltip: 'Cancel edit',
                  ),
                ],
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isOverdue)
                    IconButton(
                      icon: const Icon(Icons.calendar_today, size: 18),
                      onPressed: () => _handleRescheduleTodo(todo),
                      tooltip: 'Reschedule to Today',
                    ),
                  IconButton(
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    onPressed: () => _startInlineEdit(todo),
                    tooltip: 'Edit task inline',
                  ),
                  IconButton(
                    icon: Icon(Icons.delete_outline, size: 18, color: theme.colorScheme.error.withOpacity(0.8)),
                    onPressed: () => _handleDeleteTodo(todo),
                    tooltip: 'Delete task',
                  ),
                ],
              ),
      ),
    );
  }
}
