class Todo {
  final String id;
  final String userId;
  String text;
  bool completed;
  String date; // YYYY-MM-DD
  final DateTime? createdAt;

  Todo({
    required this.id,
    required this.userId,
    required this.text,
    required this.completed,
    required this.date,
    this.createdAt,
  });

  factory Todo.fromJson(Map<String, dynamic> json) {
    return Todo(
      id: json['_id'] ?? '',
      userId: json['userId'] ?? '',
      text: json['text'] ?? '',
      completed: json['completed'] ?? false,
      date: json['date'] ?? '',
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'userId': userId,
      'text': text,
      'completed': completed,
      'date': date,
      'createdAt': createdAt?.toIso8601String(),
    };
  }
}
