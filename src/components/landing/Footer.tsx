const Footer = () => {
  return (
    <footer className="py-16 px-6 bg-foreground text-background">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12 text-sm">
          <div>
            <h3 className="font-medium text-white mb-4">제품</h3>
            <ul className="space-y-2 opacity-75">
              <li><a href="#" className="hover:opacity-100 transition-opacity">기능</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">다운로드</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">가격</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">변경사항</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-white mb-4">지원</h3>
            <ul className="space-y-2 opacity-75">
              <li><a href="#" className="hover:opacity-100 transition-opacity">문서</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">FAQ</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">포럼</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">문의</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-white mb-4">회사</h3>
            <ul className="space-y-2 opacity-75">
              <li><a href="#" className="hover:opacity-100 transition-opacity">소개</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">블로그</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">프레스 킷</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">파트너</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-white mb-4">법률</h3>
            <ul className="space-y-2 opacity-75">
              <li><a href="#" className="hover:opacity-100 transition-opacity">개인정보</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">이용약관</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">라이선스</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-white mb-4">연결</h3>
            <ul className="space-y-2 opacity-75">
              <li><a href="#" className="hover:opacity-100 transition-opacity">Twitter</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">GitHub</a></li>
              <li><a href="#" className="hover:opacity-100 transition-opacity">이메일</a></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-background/20 text-center">
          <p className="opacity-50 text-sm">© 2024 Typora. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
