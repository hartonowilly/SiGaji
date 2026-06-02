import 'package:flutter_test/flutter_test.dart';
import 'package:sigaji_mobile/app.dart';

void main() {
  testWidgets('App loads', (tester) async {
    await tester.pumpWidget(const SigajiApp());
    expect(find.text('Pengaturan server'), findsOneWidget);
  });
}
