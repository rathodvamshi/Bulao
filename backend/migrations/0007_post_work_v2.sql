-- Post Work v2 category and role inserts
INSERT OR IGNORE INTO categories(id,kind,name,icon) VALUES ('construction','job','Construction','hammer'),('other-work','job','Other work','grid');
INSERT OR IGNORE INTO roles(id,category_id,name) VALUES ('construction-painter','construction','Painter'),('construction-mason','construction','Mason'),('construction-helper','construction','Construction helper'),('other-work-role','other-work','Other work');
